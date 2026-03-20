/** unknown 타입의 에러에서 안전하게 message를 추출한다 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** unknown 타입의 에러에서 안전하게 stack trace를 추출한다 */
export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
