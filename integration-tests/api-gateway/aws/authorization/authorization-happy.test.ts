
import { stackOutputs } from "../../../step-functions/aws/resources/cloudformation-helper";
import { getItemByKey } from "../../../step-functions/aws/resources/dynamodb-helper";
import { authorizationEndpoint, checkEndpoint, createSession } from "../../endpoints";

jest.setTimeout(30000)
        
describe("Private API Happy Path Tests", () => {
  let authCode: any;
  let sessionId: string;
  let state: string;
  let redirect_uri: string;
  let clientId= 'ipv-core-stub-aws-prod'
  let nino = "AA123456C";
  
  let output: Partial<{
      CommonStackName: string;
    }>;
  let sessionTableName: string;

    beforeAll ( async ()  => {

    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;

        const session = await createSession()
        const sessionData = await session.json()
        sessionId = sessionData.session_id
        state = sessionData.state
        redirect_uri = sessionData.redirect_uri
        await checkEndpoint(sessionId, nino)
    })

        it("Authorization API", async () => {
            const authResponse = await authorizationEndpoint(sessionId, clientId, redirect_uri, state)
            const authData = await authResponse.json();
            authCode = authData.authorizationCode;
        
            expect(authResponse.status).toEqual(200);
            expect(authCode).toBeDefined();

                const sessionRecord = await getItemByKey(sessionTableName, {
                sessionId: sessionId,
              });

            //Checking DynamoDB to ensure authCode is displayed
            expect(sessionRecord.Item?.authorizationCode).toEqual(authCode.value);
            expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBeDefined();
        });
});