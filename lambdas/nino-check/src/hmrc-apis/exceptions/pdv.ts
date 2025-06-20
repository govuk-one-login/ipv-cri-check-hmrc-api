export class PersonDeceasedError extends Error {
  public readonly name = "PersonDeceasedError";

  public get message() {
    return `Person is deceased in HMRC's records!`;
  }
}

export class FailedMatchError extends Error {
  public readonly name = "FailedMatchError";

  constructor(public readonly sessionId: string) {
    super();
  }

  public get message() {
    return `Failed to match session ${this.sessionId} in HMRC's records.`;
  }
}

export class FailedAuthError extends Error {
  public readonly name = "FailedAuthError";

  public get message() {
    return `Failed to authenticate with the HMRC PDV API.`;
  }
}

export class PdvApiError extends Error {
  public readonly name = "PdvApiError";

  constructor(public readonly statusCode: number) {
    super();
  }

  public get message() {
    return `HMRC PDV API returned an unexpected error (status: ${this.statusCode}).`;
  }
}
