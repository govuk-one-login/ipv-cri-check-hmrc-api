package org.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.example.models.MatchingRequest;
import org.example.models.MatchingResponse;
import org.example.models.NinoCheckPayload;
import org.example.models.SessionItem;
import org.example.service.ConfigParameter;
import org.example.service.OAuthTokenGenerator;
import org.example.service.PersonIdentityService;
import org.example.service.SessionService;
import org.example.service.aws.DynamoDBRequests;
import org.example.service.aws.SsmService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import software.amazon.awssdk.http.HttpStatusCode;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;
import software.amazon.lambda.powertools.metrics.Metrics;
import software.amazon.lambda.powertools.logging.CorrelationIdPathConstants;
import software.amazon.lambda.powertools.logging.Logging;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class NinoCheckFunction
        implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final Logger LOGGER = LoggerFactory.getLogger(NinoCheckFunction.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final String commonStackName;
    private final String sessionTableName;
    private final String personIdentityTableName;
    private final String userAttemptsTableName;
    private final String userAgent;
    private final String auditEventNameRequestSent;
    private final String auditEventNameResponseReceived;
    private final String auditEventPrefix;
    private final String bearerTokenName;
    private final String checkHmrcEventBus;
    private final String checkHmrcEventBusSource;
    private final String ninoUsersTable;

    @Inject DynamoDbClient dynamoDbClient;
    @Inject EventBridgeClient eventBridgeClient;
    @Inject SessionService sessionService;
    @Inject PersonIdentityService personIdentityService;
    @Inject SsmService ssmService;

    @Inject DynamoDBRequests requests;

    public NinoCheckFunction() {
        this.commonStackName = System.getenv("CommonStackName");
        this.sessionTableName = "session-%s".formatted(commonStackName);
        this.personIdentityTableName = "person-identity-%s".formatted(commonStackName);
        this.userAttemptsTableName = System.getenv("UserAttemptsTable");
        this.userAgent = System.getenv("UserAgent");
        this.auditEventNameRequestSent = System.getenv("AuditEventNameRequestSent");
        this.auditEventNameResponseReceived = System.getenv("AuditEventNameResponseReceived");
        this.auditEventPrefix = System.getenv("AuditEventPrefix");
        this.bearerTokenName = System.getenv("BearerTokenName");
        this.checkHmrcEventBus = System.getenv("CheckHmrcEventBus");
        this.checkHmrcEventBusSource = System.getenv("CheckHmrcEventBusSource");
        this.ninoUsersTable = System.getenv("NinoUsersTable");
    }

    @Override
    @Metrics(captureColdStart = true)
    @Logging(correlationIdPath = CorrelationIdPathConstants.API_GATEWAY_REST, clearState = true)
    public APIGatewayProxyResponseEvent handleRequest(
            APIGatewayProxyRequestEvent request, Context context) {
        APIGatewayProxyResponseEvent response = new APIGatewayProxyResponseEvent();
        try {
            NinoCheckPayload payload =
                    OBJECT_MAPPER.readValue(request.getBody(), NinoCheckPayload.class);
            String sessionId = payload.sessionId();
            LOGGER.info("Received NINO check request from session {}", sessionId);

            SessionItem sessionItem = sessionService.getSession(sessionTableName, sessionId);

            if (!sessionService.isSessionValid(sessionItem)) {
                response.setStatusCode(HttpStatusCode.BAD_REQUEST);
                return response;
            }

            int userAttempts = getUserAttempts(sessionId);

            if (userAttempts >= 2) {
                return respondWithSuccess();
            }

            Map<String, AttributeValue> personIdentity =
                    personIdentityService.getPersonIdentityRecord(
                            personIdentityTableName, sessionId);

            if (personIdentity == null) {
                response.setStatusCode(HttpStatusCode.INTERNAL_SERVER_ERROR);
                return response;
            }

            Map<ConfigParameter, String> parameters =
                    ssmService.getParameters(sessionItem.clientId());

            String bearerToken =
                    OAuthTokenGenerator.fetchBearerToken(parameters.get(ConfigParameter.OTG_URL));

            if (bearerToken.isBlank()) {
                return respondWithError();
            }
            
            List<AttributeValue> nameParts =
                    personIdentity.get("names").l().get(0).m().get("nameParts").l();
            String firstName = nameParts.get(0).m().get("value").s();
            String lastName = nameParts.get(1).m().get("value").s();
            String dob = personIdentity.get("birthDates").l().get(0).m().get("value").s();
            String nino = payload.nino();

            // sendAuditEventRequestSent(sessionItem);
            
            HttpResponse<String> matchingAPIResponse =
                    callMatchingAPI(
                            parameters.get(ConfigParameter.NINO_CHECK_URL),
                            new MatchingRequest(firstName, lastName, dob, nino));

            if (matchingAPIResponse == null) {
                return respondWithError();
            }

            // sendAuditEventResponseReceived();
            
            LOGGER.info("Received HTTP status code {} from Matching API", matchingAPIResponse.statusCode());
            
            String txn = matchingAPIResponse.headers().firstValue("x-amz-cf-id").orElse("");

            String body = matchingAPIResponse.body();
            
            MatchingResponse matchingResponse;

            if(!body.isBlank()) {
                matchingResponse =
                        OBJECT_MAPPER.readValue(matchingAPIResponse.body(), MatchingResponse.class);
            } else {
                matchingResponse = new MatchingResponse(new HashMap<>());
            }
            
            dynamoDbClient.updateItem(requests.storeTxn(sessionTableName, sessionId, txn));

            if (matchingAPIResponse.statusCode() == 200) {
                dynamoDbClient.putItem(
                        requests.putCheckStatus(
                                userAttemptsTableName,
                                sessionId,
                                matchingAPIResponse.statusCode(),
                                matchingAPIResponse.body(),
                                "PASS".toUpperCase(),
                                sessionItem.expiryDate()));
            } else if (matchingAPIResponse.statusCode() == 401) {
                dynamoDbClient.putItem(
                        requests.putCheckStatus(
                                userAttemptsTableName,
                                sessionId,
                                matchingAPIResponse.statusCode(),
                                OBJECT_MAPPER.writeValueAsString(matchingResponse.errors()),
                                "FAIL".toUpperCase(),
                                sessionItem.expiryDate()));
            } else if (matchingAPIResponse.statusCode() == 424) {
                dynamoDbClient.putItem(
                        requests.putCheckStatus(
                                userAttemptsTableName,
                                sessionId,
                                matchingAPIResponse.statusCode(),
                                matchingAPIResponse.body(),
                                "FAIL".toUpperCase(),
                                sessionItem.expiryDate()));
            } else {
                return respondWithError();
            }

            if (matchingAPIResponse.statusCode() == 200 || userAttempts == 1) {
                dynamoDbClient.updateItem(
                        requests.updateAuthCodeAndExpiry(sessionTableName, sessionId));
                dynamoDbClient.putItem(
                        requests.putUsersTable(
                                ninoUsersTable, sessionId, nino, sessionItem.expiryDate()));
                return respondWithSuccess();
            }

            return respondWithRetry();

        } catch (Exception e) {
            LOGGER.error("An error occurred within the handler", e);
            return respondWithError(e.getMessage());
        }
    }

    private HttpResponse<String> callMatchingAPI(String apiURL, MatchingRequest matchingRequest) {
        try {
            HttpClient client = HttpClient.newBuilder().build();
            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(URI.create(apiURL))
                            .header("Content-Type", "application/json")
                            .header("User-Agent", userAgent)
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            OBJECT_MAPPER.writeValueAsString(matchingRequest),
                                            StandardCharsets.UTF_8))
                            .build();
            return client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            LOGGER.error("Failed to call matching API", e);
            return null;
        }
    }

    private void sendAuditEventRequestSent(
            SessionItem sessionItem, NinoCheckPayload payload, String nino, String issuer) {
        PutEventsRequestEntry eventRequestEntry =
                PutEventsRequestEntry.builder()
                        .detail(
                                """
                        {
                            "auditPrefix": "IPV_HMRC_RECORD_CHECK_CRI",
                            "user": "$.sessionCheck.userAuditInfo",
                            "deviceInformation": "%s",
                            "nino": "%s",
                            "userInfoEvent": "$.userInfo",
                            "issuer": "%s"
                        }
                        """
                                        .formatted(payload.txmaAuditEncoded(), nino, issuer))
                        .detailType(auditEventNameRequestSent)
                        .eventBusName("default")
                        .source(checkHmrcEventBusSource)
                        .build();

        PutEventsRequest request = PutEventsRequest.builder().entries(eventRequestEntry).build();

        eventBridgeClient.putEvents(request);
    }

    private int getUserAttempts(String sessionId) {
        return dynamoDbClient
                .query(
                        QueryRequest.builder()
                                .tableName(userAttemptsTableName)
                                .keyConditionExpression("sessionId = :sessionId")
                                .expressionAttributeValues(
                                        Map.of(
                                                ":sessionId",
                                                AttributeValue.builder().s(sessionId).build()))
                                .build())
                .count();
    }

    public static APIGatewayProxyResponseEvent respondWithSuccess() {
        APIGatewayProxyResponseEvent event = new APIGatewayProxyResponseEvent();
        event.setStatusCode(HttpStatusCode.OK);
        event.setBody("{\"requestRetry\":false}");
        return event;
    }

    public static APIGatewayProxyResponseEvent respondWithRetry() {
        APIGatewayProxyResponseEvent event = new APIGatewayProxyResponseEvent();
        event.setStatusCode(HttpStatusCode.OK);
        event.setBody("{\"requestRetry\":true}");
        return event;
    }

    public static APIGatewayProxyResponseEvent respondWithError(String message) {
        APIGatewayProxyResponseEvent event = new APIGatewayProxyResponseEvent();
        event.setStatusCode(HttpStatusCode.INTERNAL_SERVER_ERROR);
        event.setBody(message);
        return event;
    }

    public static APIGatewayProxyResponseEvent respondWithError() {
        APIGatewayProxyResponseEvent event = new APIGatewayProxyResponseEvent();
        event.setStatusCode(HttpStatusCode.INTERNAL_SERVER_ERROR);
        return event;
    }
}
