export class RecordExpiredError extends Error {
  public readonly name = "RecordExpiredError";

  constructor(
    public readonly tableName: string,
    public readonly sessionId: string,
    public readonly expiryDates: number[]
  ) {
    super();
  }

  public get message() {
    return `Found only expired records on the ${this.tableName} table for sessionId ${
      this.sessionId
    }: ${this.expiryDates
      // multiply by 1000 as expiryDate is in Unix seconds but Date expects milliseconds
      .map((r) => new Date(r * 1000).toISOString())
      .join(", ")}.`;
  }
}

export class RecordNotFoundError extends Error {
  public readonly name = "RecordNotFoundError";

  constructor(
    public readonly tableName: string,
    public readonly sessionId: string
  ) {
    super();
  }

  public get message() {
    return `Failed to find a valid entry in the ${this.tableName} table with session ID ${this.sessionId}.`;
  }
}

export class TooManyRecordsError extends Error {
  public readonly name = "TooManyRecordsError";

  constructor(
    public readonly tableName: string,
    public readonly sessionId: string,
    public readonly recordCount: number
  ) {
    super();
  }

  public get message() {
    return `Found ${this.recordCount} records in ${this.tableName} for sessionId ${this.sessionId}! This should not be possible as sessionId should be unique.`;
  }
}
