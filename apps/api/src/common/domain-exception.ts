/**
 * 도메인 규칙 위반 시 throw하는 예외.
 * HTTP를 모르며, DomainExceptionFilter가 HTTP 400으로 매핑한다.
 */
export class DomainException extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
