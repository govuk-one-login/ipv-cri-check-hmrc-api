package org.example.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class OAuthTokenGenerator {
    private static final Logger LOGGER = LoggerFactory.getLogger(OAuthTokenGenerator.class);

    public static String fetchBearerToken(String apiURL) {
        LOGGER.info("Calling OTG API URL: {}", apiURL);

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(apiURL)).build();
        try {
            HttpResponse<String> response =
                    client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOGGER.warn("Received non-200 response from OTG: {}", response.statusCode());
            } else {
                LOGGER.info("OTG API token retrieved successfully");
            }

            return response.body();
        } catch (IOException | InterruptedException e) {
            LOGGER.error("Error while fetching bearer token", e);
            return "";
        }
    }
}
