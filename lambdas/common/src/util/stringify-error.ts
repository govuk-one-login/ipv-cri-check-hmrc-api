export function safeStringifyError(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
