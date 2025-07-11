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
