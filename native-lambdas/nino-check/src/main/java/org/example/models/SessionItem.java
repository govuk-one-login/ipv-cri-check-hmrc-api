package org.example.models;

public record SessionItem(
        String sessionId,
        String clientId,
        long expiryDate,
        String clientIpAddress,
        String persistentSessionId,
        String userId,
        String journeyId) {}
