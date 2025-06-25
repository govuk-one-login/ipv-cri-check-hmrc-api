export class CriError extends Error {
  public readonly name = "CriError";

  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}
