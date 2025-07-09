export function safeStringifyError(error: unknown) {
  const errorType = error instanceof Error ? error.name : typeof error;

  if (process.env.LOG_FULL_ERRORS === "true") {
    return `${errorType} (${String(error)})`;
  }
  return errorType;
}
