import { ninoCheckEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { clearAttemptsTable, clearItemsFromTables, queryItemsBySessionId } from "../../resources/dynamodb-helper";
import { NINO } from "../env-variables";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("check-lambda retry logic", { timeout: 30_000 /* 30s */ }, () => {
  const errorNino = "ER123456A";
  let sessionId: string;
  let sessionTableName: string;
  let privateApi: string;

  beforeEach(async () => {
    privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    const data = await getJarAuthorization();
    const request = await data.json();
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${process.env.NINO_USERS_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${process.env.USERS_ATTEMPTS_TABLE}`);
  });

  it("should not attempt further matches after 2 attempts", async () => {
    const firstCheck = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, errorNino);
    const firstResBody = { ...(await firstCheck.json()) };
    expect(firstCheck.status).toEqual(200);
    expect(firstResBody).toStrictEqual({ requestRetry: true });
    const firstAttemptsItems = await queryItemsBySessionId(process.env.USERS_ATTEMPTS_TABLE!, sessionId);
    expect(firstAttemptsItems.Count).toEqual(1);
    expect(firstAttemptsItems.Items![0].attempt).toBe("FAIL");
    expect(firstAttemptsItems.Items![0].text).toBe("CID returned no record");

    const secondCheck = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, errorNino);
    const secondResBody = { ...(await secondCheck.json()) };
    expect(secondCheck.status).toEqual(200);
    expect(secondResBody).toStrictEqual({ requestRetry: false });
    const secondAttemptsItems = await queryItemsBySessionId(process.env.USERS_ATTEMPTS_TABLE!, sessionId);
    expect(secondAttemptsItems.Count).toEqual(2);
    expect(secondAttemptsItems.Items![0].attempt).toBe("FAIL");
    expect(secondAttemptsItems.Items![1].attempt).toBe("FAIL");

    const thirdCheck = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, errorNino);
    const thirdResBody = { ...(await thirdCheck.json()) };
    expect(thirdCheck.status).toEqual(200);
    expect(thirdResBody).toStrictEqual({ requestRetry: false });
    const thirdAttemptsItems = await queryItemsBySessionId(process.env.USERS_ATTEMPTS_TABLE!, sessionId);
    expect(thirdAttemptsItems.Count).toEqual(2);
  });

  it("should successfully match even after a failed attempt", async () => {
    const firstCheck = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, errorNino);
    const firstResBody = { ...(await firstCheck.json()) };
    expect(firstCheck.status).toEqual(200);
    expect(firstResBody).toStrictEqual({ requestRetry: true });
    const firstAttemptsItems = await queryItemsBySessionId(process.env.USERS_ATTEMPTS_TABLE!, sessionId);
    expect(firstAttemptsItems.Count).toEqual(1);
    expect(firstAttemptsItems.Items![0].attempt).toBe("FAIL");

    const secondCheck = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, NINO);
    const secondResBody = { ...(await secondCheck.json()) };
    expect(secondCheck.status).toEqual(200);
    expect(secondResBody).toStrictEqual({ requestRetry: false });
    const secondAttemptsItems = await queryItemsBySessionId(process.env.USERS_ATTEMPTS_TABLE!, sessionId);
    expect(secondAttemptsItems.Count).toEqual(2);
    expect(secondAttemptsItems.Items!.some((item) => item.attempt === "PASS")).toBe(true);
    expect(secondAttemptsItems.Items!.some((item) => item.attempt === "FAIL")).toBe(true);
  });
});
