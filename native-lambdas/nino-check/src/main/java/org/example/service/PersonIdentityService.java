package org.example.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.example.service.aws.DynamoDBRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

import java.util.Map;

@ApplicationScoped
public class PersonIdentityService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonIdentityService.class);

    @Inject DynamoDbClient dynamoDbClient;

    @Inject DynamoDBRequests requests;

    public Map<String, AttributeValue> getPersonIdentityRecord(
            String personIdentityTableName, String sessionId) {
        QueryResponse queryResponse =
                dynamoDbClient.query(
                        requests.queryPersonIdentity(personIdentityTableName, sessionId));

        if (queryResponse.count() == 0) {
            LOGGER.warn("Session {} not found", sessionId);
            return null;
        }

        return queryResponse.items().get(0);
    }
}
