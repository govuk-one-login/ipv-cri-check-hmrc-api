import { createSession } from "../../endpoints";


describe("Private API Happy Path Tests", () => {
    
    it("Session API", async () => {
      // expect(ipvCoreAuthorizationUrl?.client_id).toEqual("ipv-core-stub-aws-prod");
      // expect(ipvCoreAuthorizationUrl?.request).toBeDefined();
      const sessionResponse = await createSession();
      const jsonSession = await sessionResponse.json();
      const sessionId = jsonSession.session_id;

      expect(sessionId).toBeDefined();
      expect(sessionResponse.status).toEqual(201);
    });
});