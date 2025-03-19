package org.example.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
@JsonIgnoreProperties(ignoreUnknown = true)
public record NinoCheckPayload(
        @JsonProperty("txma-audit-encoded") String txmaAuditEncoded,
        @JsonProperty("sessionId") String sessionId,
        @JsonProperty("nino") String nino) {}
