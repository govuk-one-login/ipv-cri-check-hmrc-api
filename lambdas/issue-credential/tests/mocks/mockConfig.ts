import { TimeUnits } from "../../../common/src/util/date-time";
import { mockAuditConfig } from "../../../common/tests/mocks/mockConfig";
import { CredentialIssuerEnv, IssueCredFunctionConfig, TableNames } from "../../src/config/function-config";

export const mockTableNames: TableNames = {
  sessionTable: "session-table",
  personIdentityTable: "person-identity-table",
  attemptTable: "attempt-table",
  ninoUserTable: "nino-user-table",
};

export const mockCredentialIssuerEnv: CredentialIssuerEnv = {
  issuer: "bob",
  maxJwtTtl: 1000,
  jwtTtlUnit: TimeUnits.Hours,
  vcSigningKeyId: "key-id",
};

export const mockFunctionConfig: IssueCredFunctionConfig = {
  credentialIssuerEnv: mockCredentialIssuerEnv,
  tableNames: mockTableNames,
  audit: mockAuditConfig,
};
