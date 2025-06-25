export class TooManyAttemptsError extends Error {
  public readonly name = "TooManyAttemptsError";

  constructor(
    public readonly sessionId: string,
    public readonly attemptCount: number,
    public readonly maxAttempts: number
  ) {
    super();
  }

  public get message() {
    return `Found ${this.attemptCount} attempts! This is more than the maximum (${this.maxAttempts})`;
  }
}
