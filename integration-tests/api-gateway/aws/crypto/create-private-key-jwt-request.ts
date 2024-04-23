import { buildPrivateKeyJwtParams } from "./client";
import { Payload } from "./create-jar-request-payload";

export const getPrivateJwtRequestParams = async (request: Payload, code: string): Promise<URLSearchParams> => {
  try {
    const tokenRequest = await buildPrivateKeyJwtParams(code, request);
    return tokenRequest;
  } catch (error) {
    console.error("Error while building token request:", error);
    return new URLSearchParams({});
  }
};
