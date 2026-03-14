import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { LlmOptions, LlmProvider } from './llm-provider.interface';
import { LlmQuotaExhaustedException } from './llm-provider.interface';

const QUOTA_ERROR_PATTERN = /429|quota|rate.?limit/i;

const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  BASE_DELAY_MS: 1000,
} as const;

const DEFAULT_GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
} as const;

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiLlmProvider.name);
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new Error('GEMINI_API_KEY is required');
    }

    const modelName = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: DEFAULT_GENERATION_CONFIG,
    });

    this.logger.log(`Gemini model initialized: ${modelName}`);
  }

  /** LlmProvider 구현: 재시도 로직 포함 Gemini API 호출 */
  async generateText(prompt: string, options?: LlmOptions): Promise<string> {
    const model = options ? this.createModelWithOptions(options) : this.model;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Gemini API retry attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error as Error;
        this.logger.error(`Gemini API attempt ${attempt + 1} failed: ${lastError.message}`);
      }
    }

    if (lastError && QUOTA_ERROR_PATTERN.test(lastError.message)) {
      throw new LlmQuotaExhaustedException();
    }
    throw lastError;
  }

  /**
   * LlmOptions가 지정된 경우 기본 설정을 오버라이드한 모델 인스턴스를 생성한다.
   * options가 없으면 constructor에서 생성한 기본 모델을 사용하므로 이 메서드는 호출되지 않는다.
   */
  private createModelWithOptions(options: LlmOptions): GenerativeModel {
    // constructor에서 apiKey 존재를 이미 검증했으므로 안전한 단언
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') as string;
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        ...DEFAULT_GENERATION_CONFIG,
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.maxOutputTokens !== undefined && {
          maxOutputTokens: options.maxOutputTokens,
        }),
      },
    });
  }
}
