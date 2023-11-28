import { executeStepFunction } from "../resources/stepfunction-helper";
import { populateTables } from "../resources/dynamodb-helper";
import {
  getSSMParameter,
  getSSMParameters,
  updateSSMParameters,
} from "../resources/ssm-param-helper";
import {
  clearSession,
  input as stubInput,
  isValidTimestamp,
  personIdentityData,
  user as testUser,
} from "../resources/session-helper";
import { describeStack, StackInfo } from "../resources/cloudformation-helper";

const input = stubInput();
const user = testUser(input);
let stack: StackInfo;

beforeAll(async () => {
  stack = await describeStack();
});

beforeEach(async () => {
  await populateTables(
    personIdentityData(stack, input, user),
    {
      tableName: stack.sessionTableName,
      items: {
        sessionId: input.sessionId,
        accessToken: "Bearer test",
        authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
        authorizationCodeExpiryDate: "1698925598",
        expiryDate: 9999999999,
        subject: "test",
      },
    },
    {
      tableName: stack.outputs.NinoUsersTable as string,
      items: {
        sessionId: input.sessionId,
        nino: input.nino,
      },
    },
    {
      tableName: stack.outputs.NinoAttemptsTable as string,
      items: {
        id: input.sessionId,
        attempts: 1,
        outcome: "PASS",
      },
    }
  );
});

afterEach(async () => {
  await clearSession(stack, input);
});

it("should create signed JWT when nino check is successful", async () => {
  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoIssueCredentialStateMachineArn as string,
    {
      bearerToken: "Bearer test",
    }
  );

  const currentCredentialKmsSigningKeyId = await getSSMParameter(
    stack.verifiableCredentialKmsSigningKeyId
  );

  const token = JSON.parse(startExecutionResult.output as string);
  const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
  const header = JSON.parse(atob(headerEncoded));
  const payload = JSON.parse(atob(payloadEncoded));

  expect(header.typ).toBe("JWT");
  expect(header.alg).toBe("ES256");
  expect(header.kid).toBe(currentCredentialKmsSigningKeyId);

  const evidence = payload.vc.evidence[0];
  expect(evidence.type).toBe("IdentityCheck");
  expect(evidence.strengthScore).toBe(2);
  expect(evidence.validityScore).toBe(2);
  expect(evidence.checkDetails[0].checkMethod).toBe("data");
  expect(evidence.checkDetails[0].identityCheckPolicy).toBe("published");
  expect(evidence.txn).not.toBeNull;

  const credentialSubject = payload.vc.credentialSubject;
  expect(credentialSubject.socialSecurityRecord[0].personalNumber).toBe(
    user.nino
  );

  expect(credentialSubject.name[0].nameParts[0].type).toBe("GivenName");
  expect(credentialSubject.name[0].nameParts[0].value).toBe(user.firstName);
  expect(credentialSubject.name[0].nameParts[1].type).toBe("FamilyName");
  expect(credentialSubject.name[0].nameParts[1].value).toBe(user.lastName);

  expect(payload.vc.type[0]).toBe("VerifiableCredential");
  expect(payload.vc.type[1]).toBe("IdentityCheckCredential");

  expect(payload.vc["@context"][0]).toBe(
    "https://www.w3.org/2018/credentials/v1"
  );
  expect(payload.vc["@context"][1]).toBe(
    "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld"
  );

  expect(payload.sub).not.toBeNull;
  expect(isValidTimestamp(payload.nbf)).toBe(true);
  expect(payload.iss).not.toBeNull;
  expect(isValidTimestamp(payload.exp)).toBe(true);
  expect(payload.jti).not.toBeNull;
});

it("should create the valid expiry date", async () => {
  const maxJwtTtl = `/${process.env.STACK_NAME}/MaxJwtTtl`;
  const jwtTtlUnit = `/${process.env.STACK_NAME}/JwtTtlUnit`;

  const [currentMaxJwtTtl, currentJwtTtlUnit] = await getSSMParameters(
    `/${process.env.STACK_NAME}/MaxJwtTtl`,
    `/${process.env.STACK_NAME}/JwtTtlUnit`
  );

  await updateSSMParameters(
    { name: maxJwtTtl, value: "5" },
    { name: jwtTtlUnit, value: "MINUTES" }
  );

  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoIssueCredentialStateMachineArn as string,
    {
      bearerToken: "Bearer test",
    }
  );

  await updateSSMParameters(
    { name: maxJwtTtl, value: currentMaxJwtTtl as string },
    { name: jwtTtlUnit, value: currentJwtTtlUnit as string }
  );

  const token = JSON.parse(startExecutionResult.output as string);
  const payloadEncoded = token.jwt.split(".")[1];
  const payload = JSON.parse(atob(payloadEncoded));

  expect(payload.exp).toBe(payload.nbf + 5 * 1000 * 60);
});
