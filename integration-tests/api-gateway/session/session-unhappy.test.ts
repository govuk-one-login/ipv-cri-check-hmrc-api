import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../endpoints";

describe("Given the session is valid", { timeout: 35_000 /* 35s */ }, () => {
  let anInValidSession: Response;

  beforeEach(async () => {
    const privateApi = `${process.env.PRIVATE_API}`;

    anInValidSession = await createSession(privateApi, null);
  });

  it("Should receive a 400 response when /session endpoint is called with null request body", async () => {
    expect(anInValidSession.status).toEqual(400);
  });
});
