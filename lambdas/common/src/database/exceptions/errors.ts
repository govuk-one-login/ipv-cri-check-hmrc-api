export class RecordExpiredError extends Error {
  constructor(
    public readonly tableName: string,
    public readonly sessionId: string,
    public readonly expiryDates: number[]
  ) {
    super();
  }

  get message() {
    return `Found only expired records on the ${
      this.tableName
    } table for sessionId ${this.sessionId}: ${this.expiryDates
      // multiply by 1000 as expiryDate is in Unix seconds but Date expects milliseconds
      .map((r) => new Date(r * 1000).toISOString())
      .join(", ")}.`;
  }
}

export class RecordNotFoundError extends Error {
  constructor(
    public readonly tableName: string,
    public readonly sessionId: string
  ) {
    super();
  }

  get message() {
    return `Failed to find a valid entry in the ${this.tableName} table with session ID ${this.sessionId}.`;
  }
}
