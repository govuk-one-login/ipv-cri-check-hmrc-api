import { stackOutputs } from "../../resources/cloudformation-helper";
import { createSession } from "../endpoints";
jest.setTimeout(35_000);
describe("Given the session is invalid", () => {
  it("Should receive a 400 response when /session endpoint is called with null request body", async () => {
    const preOutput = await stackOutputs(process.env.STACK_NAME);
    const privateApi = `${preOutput.PrivateApiGatewayId}`;
    const anInValidSession = createSession(privateApi, null);

    const sessionResponse = await anInValidSession;
    expect(sessionResponse.status).toEqual(400);
  });
});
