package org.example.service.aws;

import jakarta.enterprise.context.ApplicationScoped;

import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class DynamoDBRequests {

    public QueryRequest querySession(String sessionTableName, String sessionId) {
        return QueryRequest.builder()
                .tableName(sessionTableName)
                .keyConditionExpression("sessionId = :sessionId")
                .expressionAttributeValues(
                        Map.of(":sessionId", AttributeValue.builder().s(sessionId).build()))
                .build();
    }

    public QueryRequest queryPersonIdentity(String personIdentityTableName, String sessionId) {
        return QueryRequest.builder()
                .tableName(personIdentityTableName)
                .keyConditionExpression("sessionId = :sessionId")
                .expressionAttributeValues(
                        Map.of(":sessionId", AttributeValue.builder().s(sessionId).build()))
                .build();
    }

    public PutItemRequest putCheckStatus(
            String attemptsTableName,
            String sessionId,
            int status,
            String text,
            String attempt,
            long ttl) {
        return PutItemRequest.builder()
                .tableName(attemptsTableName)
                .item(
                        Map.of(
                                "sessionId", AttributeValue.builder().s(sessionId).build(),
                                "timestamp",
                                        AttributeValue.builder()
                                                .s(String.valueOf(Instant.now().getEpochSecond()))
                                                .build(),
                                "status",
                                        AttributeValue.builder().n(String.valueOf(status)).build(),
                                "text", AttributeValue.builder().s(text).build(),
                                "attempt", AttributeValue.builder().s(attempt).build(),
                                "ttl", AttributeValue.builder().n(String.valueOf(ttl)).build()))
                .build();
    }

    public UpdateItemRequest updateAuthCodeAndExpiry(String sessionTableName, String sessionId) {
        String expiry = Instant.now().plus(10, ChronoUnit.MINUTES).toString();
        return UpdateItemRequest.builder()
                .tableName(sessionTableName)
                .key(Map.of("sessionId", AttributeValue.builder().s(sessionId).build()))
                .updateExpression(
                        "SET authorizationCode = :authCode, authorizationCodeExpiryDate = :expiry")
                .expressionAttributeValues(
                        Map.of(
                                ":authCode",
                                        AttributeValue.builder()
                                                .s(UUID.randomUUID().toString())
                                                .build(),
                                ":authorizationCodeExpiryDate",
                                        AttributeValue.builder().n(expiry).build()))
                .build();
    }

    public PutItemRequest putUsersTable(
            String usersTableName, String sessionId, String nino, long expiry) {
        return PutItemRequest.builder()
                .tableName(usersTableName)
                .item(
                        Map.of(
                                "sessionId", AttributeValue.builder().s(sessionId).build(),
                                "nino", AttributeValue.builder().s(nino).build(),
                                "ttl", AttributeValue.builder().n(String.valueOf(expiry)).build()))
                .build();
    }

    public UpdateItemRequest storeTxn(String sessionTableName, String sessionId, String txn) {
        return UpdateItemRequest.builder()
                .tableName(sessionTableName)
                .key(Map.of("sessionId", AttributeValue.builder().s(sessionId).build()))
                .updateExpression("SET txn = :txn")
                .expressionAttributeValues(Map.of(":txn", AttributeValue.builder().s(txn).build()))
                .build();
    }
}
