import { loadIntegrationContext } from "../api-test-context/load-integration-context";
import { createInvalidSession } from "../endpoints";

jest.setTimeout(30_000);
describe("Given the session is invalid", () => {
  let privateApi: string;

  beforeAll(async () => {
    ({ privateApi } = await loadIntegrationContext());
  });
  it("Should receive a 400 response when /session endpoint is called with null request body", async () => {
    const sessionResponse = await createInvalidSession(privateApi);

    expect(sessionResponse.status).toEqual(400);
  });
});
