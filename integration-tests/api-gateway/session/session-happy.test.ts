import { createPayload, createSession } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";

jest.setTimeout(30_000);
describe("Given the session is valid", () => {
  let sessionId: string;
  let sessionResponse: Response;
  let privateApi: string;
  let audience: string;
  let privateSigningKey: string;
  let publicEncryptionKeyBase64: string;

  beforeAll(async () => {
    ({ privateApi, audience, privateSigningKey, publicEncryptionKeyBase64 } =
      await loadIntegrationContext());
  });

  beforeEach(async () => {
    const claimSet = await createPayload(
      audience,
      privateSigningKey,
      publicEncryptionKeyBase64
    );
    sessionResponse = await createSession(privateApi, claimSet);
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: "person-identity-common-cri-api",
        items: { sessionId: sessionId },
      },
      {
        tableName: "session-common-cri-api",
        items: { sessionId: sessionId },
      }
    );
  });

  it("Should receive a valid session id when /session endpoint is called", async () => {
    const jsonSession = await sessionResponse.json();

    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
