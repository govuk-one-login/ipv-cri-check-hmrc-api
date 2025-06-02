export class RecordExpiredError extends Error {
  constructor(
    public readonly recordName: string,
    public readonly sessionId: string,
    public readonly expiryDates: number[]
  ) {
    super();
  }

  get message() {
    return `Found only expired records for ${this.recordName} on sessionId ${
      this.sessionId
    }: ${this.expiryDates
      // multiply by 1000 as expiryDate is in Unix seconds but Date expects milliseconds
      .map((r) => new Date(r * 1000).toISOString())
      .join(", ")}.`;
  }
}

export class RecordNotFoundError extends Error {
  constructor(
    public readonly recordName: string,
    public readonly sessionId: string
  ) {
    super();
  }

  get message() {
    return `Failed to find an entry in the ${this.recordName} table with session ID ${this.sessionId}.`;
  }
}
