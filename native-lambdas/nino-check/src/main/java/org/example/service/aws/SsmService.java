package org.example.service.aws;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.example.service.ConfigParameter;

import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParametersRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;

import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class SsmService {

    @Inject SsmClient ssmClient;

    public Map<ConfigParameter, String> getParameters(String clientId) {
        Map<ConfigParameter, String> parameters = new HashMap<>();

        String otgUrl = String.format("/check-hmrc-cri-api/OtgUrl/%s", clientId);
        String ninoCheckUrl = String.format("/check-hmrc-cri-api/NinoCheckUrl/%s", clientId);
        String personIdentityTableName = "/common-cri-api/PersonIdentityTableName";
        String sessionTableName = "/common-cri-api/SessionTableName";
        String issuer = "/common-cri-api/verifiable-credential/issuer";

        GetParametersResponse response =
                ssmClient.getParameters(
                        GetParametersRequest.builder()
                                .names(
                                        otgUrl,
                                        ninoCheckUrl,
                                        personIdentityTableName,
                                        sessionTableName,
                                        issuer)
                                .build());

        for (Parameter parameter : response.parameters()) {
            if (parameter.name().equals(otgUrl)) {
                parameters.put(ConfigParameter.OTG_URL, parameter.value());
            } else if (parameter.name().equals(ninoCheckUrl)) {
                parameters.put(ConfigParameter.NINO_CHECK_URL, parameter.value());
            } else if (parameter.name().equals(personIdentityTableName)) {
                parameters.put(ConfigParameter.PERSON_IDENTITY_TABLE_NAME, parameter.value());
            } else if (parameter.name().equals(sessionTableName)) {
                parameters.put(ConfigParameter.SESSION_TABLE_NAME, parameter.value());
            } else if (parameter.name().equals(issuer)) {
                parameters.put(ConfigParameter.ISSUER_NAME, parameter.value());
            }
        }

        return parameters;
    }
}
