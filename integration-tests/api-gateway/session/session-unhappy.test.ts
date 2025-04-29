import { createSession } from "../endpoints";
jest.setTimeout(35_000);
describe("Given the session is invalid", () => {
  let anInValidSession: Response;

  beforeEach(async () => {
    const privateApi = `${process.env.PRIVATE_API}`;

    anInValidSession = await createSession(privateApi, null);
  });

  it("Should receive a 400 response when /session endpoint is called with null request body", async () => {
    expect(anInValidSession.status).toEqual(400);
  });
});
