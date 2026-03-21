export const LLM_PROVIDER = 'LLM_PROVIDER';

/** LLM API 할당량 초과 시 발생하는 예외 */
export class LlmQuotaExhaustedException extends Error {
  constructor() {
    super('LLM API quota exhausted');
    this.name = 'LlmQuotaExhaustedException';
  }
}

export interface LlmOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmProvider {
  /**
   * 프롬프트를 전달하여 LLM 텍스트 응답을 생성한다.
   * 구현체는 내부적으로 재시도 로직을 포함할 수 있다.
   */
  generateText(prompt: string, options?: LlmOptions): Promise<string>;
}
