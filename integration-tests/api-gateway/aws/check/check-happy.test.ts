import { createSessionId } from "../session/session-happy.test";

let sessionId: any;

jest.setTimeout(30000)

export const checkEndpoint = async (
  ): Promise<Response> => {
    const checkApiUrl = "https://o2u6kk85sd.execute-api.eu-west-2.amazonaws.com/localdev/check";
    const jsonData = JSON.stringify({ nino : 'AA123456C' })
    const checkResponse = await fetch(checkApiUrl, {
        method: "POST", 
        headers: {
            "Content-Type": "application/json",
            "session-id": sessionId
        }, 
        body: jsonData
    })

    return checkResponse
  }
        
describe.skip("Private API Happy Path Tests", () =>  {

    it("Check API", async () => {
        // const session = await createSessionId()
        // const sessionData = await session.json();
        // sessionId = sessionData.session_id
        const check = await checkEndpoint()
        const checkData = check.status
        expect(checkData).toEqual(200);
    });
});