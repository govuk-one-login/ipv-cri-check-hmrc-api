import { checkEndpoint, createSession } from "../../endpoints";

let sessionId: any;
let nino = "AA123456C";

jest.setTimeout(30000)

describe("Private API Happy Path Tests", () => {

    it("Check API", async () => {
        const session = await createSession()
        const sessionData = await session.json();
        sessionId = sessionData.session_id
        const check = await checkEndpoint(sessionId, nino)
        const checkData = check.status
        expect(checkData).toEqual(200);
    });
});