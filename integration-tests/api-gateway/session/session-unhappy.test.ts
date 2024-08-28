import { createInvalidSession } from "../endpoints";

describe("Given the session is invalid", () => {
  let sessionId: string;

  it("Should receive a 400 response when /session endpoint is called with null request body", async () => {
      const sessionResponse = await createInvalidSession();
      const jsonSession = await sessionResponse.json();
      sessionId = jsonSession.session_id;

      expect(sessionResponse.status).toEqual(400);
    });
});
