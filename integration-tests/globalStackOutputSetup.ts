import { stackOutputs } from "./resources/cloudformation-helper";
let outputs: Partial<{
  CommonStackName: string;
  StackName: string;
  PrivateApiGatewayId: string;
  PublicApiGatewayId: string;
  NinoUsersTable: string;
  UserAttemptsTable: string;

  NinoIssueCredentialStateMachineArn: string;
  TxMaAuditEventRule: string;
  TxMaAuditEventRuleArn: string;
  AuditEventAbandonedRule: string;
  AuditEventAbandonedRuleArn: string;
  AuditEventVcIssuedRule: string;
  AuditEventVcIssuedRuleArn: string;
  AuditEventEndRule: string;
  AuditEventEndRuleArn: string;
  AuditEventRequestSentRule: string;
  AuditEventRequestSentRuleArn: string;
  AuditEventResponseReceivedRule: string;
  AuditEventResponseReceivedRuleArn: string;
}>;

export default async function globalSetup() {
  try {
    const stackName = process.env.STACK_NAME;
    if (!stackName)
      throw new Error("STACK_NAME environment variable is not set.");

    outputs = await stackOutputs(stackName);
    if (!outputs?.CommonStackName)
      throw new Error("Missing CommonStackName in stack outputs.");

    process.env.AWS_REGION = "eu-west-2";
    process.env.COMMON_STACK_NAME = outputs.CommonStackName;
    process.env.STACK_NAME = outputs.StackName;
    process.env.PRIVATE_API = outputs.PrivateApiGatewayId || "";
    process.env.PUBLIC_API = outputs.PublicApiGatewayId || "";
    process.env.NINO_USERS_TABLE =
      outputs.NinoUsersTable || "check-hmrc-cri-api-nino-users";
    process.env.USERS_ATTEMPTS_TABLE =
      outputs.UserAttemptsTable || "check-hmrc-cri-api-user-attempts";
    process.env.PERSON_IDENTITY_TABLE =
      `person-identity-${outputs.CommonStackName}` ||
      "person-identity-common-cri-api";
    process.env.SESSION_TABLE =
      `session-${outputs.CommonStackName}` || "session-common-cri-api";

    process.env.NINO_CREDENTIAL_STATE_MACHINE_ARN =
      outputs.NinoIssueCredentialStateMachineArn;
    process.env.TXMA_AUDIT_EVENT_RULE_ENV = outputs.TxMaAuditEventRule;
    process.env.TXMA_AUDIT_EVENT_RULE_ARN = outputs.TxMaAuditEventRuleArn;
    process.env.AUDIT_EVENT_ABANDON_RULE_ENV = outputs.AuditEventAbandonedRule;
    process.env.AUDIT_EVENT_ABANDON_RULE_ARN =
      outputs.AuditEventAbandonedRuleArn;
    process.env.AUDIT_EVENT_VC_ISSUED_RULE = outputs.AuditEventVcIssuedRule;
    process.env.AUDIT_EVENT_VC_ISSUED_RULE_ARN =
      outputs.AuditEventVcIssuedRuleArn;
    process.env.AUDIT_EVENT_END_RULE = outputs.AuditEventEndRule;
    process.env.AUDIT_EVENT_END_RULE_ARN = outputs.AuditEventEndRuleArn;
    process.env.AUDIT_EVENT_REQUEST_SENT_RULE =
      outputs.AuditEventRequestSentRule;
    process.env.AUDIT_EVENT_REQUEST_SENT_RULE_ARN =
      outputs.AuditEventRequestSentRuleArn;
    process.env.AUDIT_EVENT_RESPONSE_RECEIVED_RULE =
      outputs.AuditEventResponseReceivedRule;
    process.env.AUDIT_EVENT_RESPONSE_RECEIVED_RULE_ARN =
      outputs.AuditEventResponseReceivedRuleArn;

    // eslint-disable-next-line no-console
    console.log("✅ Env vars set in globalSetup");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to set up environment for tests:", error);
    throw error;
  }
}
