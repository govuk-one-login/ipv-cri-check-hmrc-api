package org.example.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.example.models.SessionItem;
import org.example.service.aws.DynamoDBRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

import java.time.Instant;
import java.util.Map;

@ApplicationScoped
public class SessionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SessionService.class.getName());

    @Inject DynamoDbClient dynamoDbClient;

    @Inject DynamoDBRequests requests;

    public SessionItem getSession(String sessionTableName, String sessionId) {
        QueryResponse queryResponse =
                dynamoDbClient.query(requests.querySession(sessionTableName, sessionId));

        if (queryResponse.count() == 0) {
            LOGGER.warn("Session {} not found", sessionId);
            return null;
        }

        Map<String, AttributeValue> attributes = queryResponse.items().get(0);

        return new SessionItem(
                sessionId,
                attributes.get("clientId").s(),
                Long.parseLong(attributes.get("expiryDate").n()),
                attributes.get("clientIpAddress").s(),
                attributes.get("persistentSessionId").s(),
                attributes.get("subject").s(),
                attributes.get("clientSessionId").s());
    }

    public boolean isSessionValid(SessionItem sessionItem) {
        if (sessionItem == null) {
            return false;
        }
        long currentTime = Instant.now().getEpochSecond();
        long expiryDate = sessionItem.expiryDate();
        if (currentTime > expiryDate) {
            LOGGER.warn("Session {} expired", sessionItem.sessionId());
            return false;
        }
        return true;
    }
}
