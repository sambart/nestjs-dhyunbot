import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VoiceActivityData } from './voice-analytics.service';

export interface VoiceAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  topActiveUsers: Array<{
    username: string;
    activity: string;
    stats: string;
  }>;
  channelUsageAnalysis: string;
  micUsagePatterns: string;
  trends: string[];
  concerns: string[];
}

@Injectable()
export class VoiceGeminiService {
  private readonly logger = new Logger(VoiceGeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found in environment variables');
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Gemini 2.0 Flash 또는 1.5 Pro 사용
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // 또는 'gemini-1.5-pro-latest'
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192, // 토큰 제한 대폭 증가
        responseMimeType: 'application/json', // JSON 모드 강제
      },
    });
  }

  /**
   * 음성 채널 활동 데이터를 분석하고 인사이트 제공
   */
  async analyzeVoiceActivity(activityData: VoiceActivityData): Promise<VoiceAnalysisResult> {
    try {
      const prompt = this.buildVoiceAnalysisPrompt(activityData);

      this.logger.log('Sending voice activity data to Gemini API...');
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const analysis = this.parseGeminiResponse(text);

      this.logger.log('Successfully analyzed voice activity');
      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze voice activity', error.stack);
      throw new Error('Voice activity analysis failed');
    }
  }

  /**
   * Gemini를 위한 프롬프트 생성
   */
  private buildVoiceAnalysisPrompt(data: VoiceActivityData): string {
    const jsonData = JSON.stringify(data, null, 2);

    // 시간을 사람이 읽기 쉬운 형식으로 변환하는 헬퍼 함수 설명
    const timeExplanation = `
참고: 모든 시간 단위는 초(seconds)입니다.
- 3600초 = 1시간
- 86400초 = 1일
- channelDurationSec: 음성 채널에 있던 총 시간
- micOnSec: 마이크를 켠 시간
- micOffSec: 마이크를 끈 시간
- aloneSec: 혼자 채널에 있던 시간
`;

    return `당신은 Discord 서버의 음성 채널 활동 분석 전문가입니다. 
다음 데이터는 서버의 음성 채널 사용 패턴을 담고 있습니다.

${timeExplanation}

**음성 채널 활동 데이터:**
\`\`\`json
${jsonData}
\`\`\`

**분석 요구사항:**

1. **전체 활동 패턴 분석**
   - 서버의 음성 채널 활용도는 어떤가요?
   - 유저들의 참여 패턴은 어떤가요? (일일 평균 활성 유저, 총 사용 시간 등)
   - 기간 동안의 트렌드는 어떤가요? (증가/감소/정체)

2. **유저 행동 분석**
   - 가장 활동적인 유저들의 특징은?
   - 마이크 사용 패턴 (항상 켜는 유저 vs 주로 듣기만 하는 유저)
   - 혼자 있는 시간이 많은 유저가 있나요? (외로운 유저 감지)

3. **채널 사용 분석**
   - 어떤 채널이 가장 인기 있나요?
   - 채널별 사용 목적을 추론할 수 있나요?
   - 채널 수가 적절한가요? (과부하 또는 사용되지 않는 채널)

4. **개선 제안**
   - 커뮤니티 활성화를 위한 실질적인 제안
   - 새로운 채널 개설 또는 기존 채널 정리 제안
   - 이벤트 시간대 추천

5. **우려사항 감지**
   - 커뮤니티 건강도에 문제가 있나요?
   - 이탈 위험 신호가 있나요?
   - 특이한 패턴이나 주의가 필요한 부분

**JSON 스키마 (이 형식 그대로 반환):**
{
  "summary": string,
  "insights": [string, string, string, string],
  "recommendations": [string, string, string],
  "topActiveUsers": [
    {
      "username": string,
      "activity": string,
      "stats": string
    }
  ],
  "channelUsageAnalysis": string,
  "micUsagePatterns": string,
  "trends": [string, string],
  "concerns": [string]
}

**규칙:**
1. 순수 JSON 객체만 반환 (마크다운, 설명, 코드블록 금지)
2. 모든 시간은 "시간", "분" 단위로 변환
3. 구체적인 숫자와 비율 포함
4. 한글로 작성

JSON 응답:`;
  }

  /**
   * Gemini 응답 파싱
   */
  private parseGeminiResponse(text: string): VoiceAnalysisResult {
    try {
      let cleanedText = text.trim();

      // 마크다운 코드 블록 제거
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }

      const parsed = JSON.parse(cleanedText);

      if (!this.isValidVoiceAnalysis(parsed)) {
        throw new Error('Invalid response structure from Gemini');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse Gemini response', error.stack);
      this.logger.debug('Raw response:', text);

      return {
        summary: '분석 중 오류가 발생했습니다.',
        insights: ['응답을 파싱하지 못했습니다.'],
        recommendations: ['다시 시도해주세요.'],
        topActiveUsers: [],
        channelUsageAnalysis: '데이터 없음',
        micUsagePatterns: '데이터 없음',
        trends: [],
        concerns: [],
      };
    }
  }

  /**
   * 응답 유효성 검증
   */
  private isValidVoiceAnalysis(obj: any): obj is VoiceAnalysisResult {
    return (
      typeof obj === 'object' &&
      typeof obj.summary === 'string' &&
      Array.isArray(obj.insights) &&
      Array.isArray(obj.recommendations) &&
      Array.isArray(obj.topActiveUsers) &&
      typeof obj.channelUsageAnalysis === 'string' &&
      typeof obj.micUsagePatterns === 'string' &&
      Array.isArray(obj.trends) &&
      Array.isArray(obj.concerns)
    );
  }

  /**
   * 특정 유저의 활동 심층 분석
   */
  async analyzeSpecificUser(activityData: VoiceActivityData, targetUserId: string): Promise<any> {
    const userActivity = activityData.userActivities.find((u) => u.userId === targetUserId);

    if (!userActivity) {
      throw new Error('User not found in activity data');
    }

    const prompt = `
유저의 음성 채널 활동 데이터:
${JSON.stringify(userActivity, null, 2)}

다음 JSON 스키마에 정확히 맞춰 응답하세요:
{
  "activityLevel": string ("높음" | "보통" | "낮음"),
  "personality": string,
  "strengths": [string, string],
  "concerns": [string],
  "suggestions": [string, string]
}

JSON만 반환하세요.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.trim());
    } catch (error) {
      this.logger.error('Failed to parse user-specific analysis', error);
      return {
        activityLevel: '보통',
        personality: '분석 불가',
        strengths: ['데이터 부족'],
        concerns: ['분석 실패'],
        suggestions: ['다시 시도해주세요'],
      };
    }
  }

  /**
   * 커뮤니티 건강도 점수 산출
   */
  async calculateCommunityHealth(activityData: VoiceActivityData): Promise<any> {
    // 데이터 요약 (토큰 절약)
    const summarizedData = {
      guildId: activityData.guildId,
      timeRange: activityData.timeRange,
      totalStats: activityData.totalStats,
      topUsers: activityData.userActivities.slice(0, 5).map((u) => ({
        username: u.username,
        totalVoiceTime: u.totalVoiceTime,
        micUsageRate: u.micUsageRate,
        activeDays: u.activeDays,
      })),
      topChannels: activityData.channelStats.slice(0, 3).map((c) => ({
        channelName: c.channelName,
        totalVoiceTime: c.totalVoiceTime,
        uniqueUsers: c.uniqueUsers,
      })),
      recentTrends: activityData.dailyTrends.slice(-7), // 최근 7일만
    };

    const prompt = `
음성 채널 활동 데이터로 커뮤니티 건강도를 0-100 점수로 평가하세요.

데이터:
${JSON.stringify(summarizedData, null, 2)}

JSON 응답 (한글, 각 필드 50자 이내):
{
  "healthScore": 숫자,
  "factors": {
    "engagement": "참여도 평가",
    "growth": "성장 평가",
    "interaction": "상호작용 평가",
    "retention": "유지율 평가"
  },
  "status": "건강함|주의필요|위험",
  "advice": "간단한 조언"
}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      this.logger.debug('Health response length:', text.length);

      // 응답이 완전한지 확인
      if (!text || text.length < 50) {
        throw new Error('Response too short or empty');
      }

      // JSON 파싱 시도
      const parsed = JSON.parse(text.trim());

      // 필수 필드 검증
      if (typeof parsed.healthScore !== 'number' || !parsed.factors || !parsed.status) {
        throw new Error('Invalid response structure');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to calculate health score:', error.message);

      // 기본값 반환
      return {
        healthScore: 50,
        factors: {
          engagement: '데이터 부족',
          growth: '분석 불가',
          interaction: '데이터 부족',
          retention: '분석 불가',
        },
        status: '분석 실패',
        advice: 'API 응답 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      };
    }
  }
}
