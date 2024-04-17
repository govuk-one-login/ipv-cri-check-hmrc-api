import { stackOutputs } from "../../../step-functions/aws/resources/cloudformation-helper";
import { getItemByKey } from "../../../step-functions/aws/resources/dynamodb-helper";
import { abandonEndpoint, authorizationEndpoint, checkEndpoint, createSession } from "../../endpoints";

let sessionId: string;
let sessionTableName: string;
let state: string;
let redirect_uri: string;
let client_id = 'ipv-core-stub-aws-build';
let nino = "AA123456C";


let output: Partial<{
    CommonStackName: string;
  }>;

output = await stackOutputs(process.env.STACK_NAME);
sessionTableName = `session-${output.CommonStackName}`;


describe("Private API Happy Path Tests", () => {

    beforeAll ( async ()  => {
        const session = await createSession()
        const sessionData = await session.json()
        sessionId = sessionData.session_id
        state = sessionData.state
        redirect_uri = sessionData.redirect_uri
        await checkEndpoint(sessionId, nino)
        await authorizationEndpoint(sessionId, client_id, redirect_uri, state)
    })

    it("Abandon API", async () => {
        const abandonResponse = await abandonEndpoint (sessionId)
        expect(abandonResponse).toEqual(200);

        const sessionRecord = await getItemByKey(sessionTableName, {
            sessionId: sessionId,
          });

         //Checking DynamoDB to ensure authCode is displayed
        expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
        expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
    });
});