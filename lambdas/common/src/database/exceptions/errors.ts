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
    const expiries = this.expiryDates
      // multiply by 1000 as expiryDate is in Unix seconds but Date expects milliseconds
      .map((r) => new Date(r * 1000).toISOString())
      .join(", ");

    return `Found only expired records on the ${this.tableName} table: ${expiries}.`;
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
    return `Failed to find a valid entry in the ${this.tableName} table.`;
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
    return `Found ${this.recordCount} records in ${this.tableName}! This should not be possible as we expect sessionId to be unique.`;
  }
}
