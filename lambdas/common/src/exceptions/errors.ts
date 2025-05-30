export class RecordExpiredError extends Error {
  constructor(
    public readonly recordName: string,
    public readonly sessionId: string,
    public readonly expiryDate: number
  ) {
    super();
  }

  get message() {
    return `${this.recordName} with session ID ${
      this.sessionId
    } has expired (expiry time: ${new Date(this.expiryDate).toISOString()}).`;
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
