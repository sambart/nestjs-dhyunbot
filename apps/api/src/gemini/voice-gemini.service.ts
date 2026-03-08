import { VoiceActivityData, VoiceAnalysisResult } from '@dhyunbot/shared';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        // responseMimeType 제거 - 일반 텍스트로 받기
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

      this.logger.log('Successfully analyzed voice activity');
      return { text };
    } catch (error) {
      this.logger.error('Failed to analyze voice activity', (error as Error).stack);
      return {
        text:
          '⚠️ 분석 중 오류가 발생했습니다.\n\n' +
          '기본 통계:\n' +
          `- 총 활성 유저: ${activityData.totalStats.totalUsers}명\n` +
          `- 총 음성 시간: ${Math.floor(activityData.totalStats.totalVoiceTime / 3600)}시간\n` +
          `- 일평균 활성 유저: ${activityData.totalStats.avgDailyActiveUsers}명`,
      };
    }
  }

  /**
   * Gemini를 위한 프롬프트 생성
   */
  private buildVoiceAnalysisPrompt(data: VoiceActivityData): string {
    // 데이터 요약 (너무 길면 토큰 초과)
    const summarizedData = {
      guildName: data.guildName,
      timeRange: data.timeRange,
      totalStats: data.totalStats,
      topUsers: data.userActivities.slice(0, 10),
      topChannels: data.channelStats.slice(0, 5),
      recentTrends: data.dailyTrends.slice(-7),
    };

    const timeExplanation = `
      참고: 시간 단위는 초(seconds)입니다.
      - 3600초 = 1시간
      - 86400초 = 1일
      `;

    return `
      당신은 Discord 서버의 음성 채널 활동 분석 전문가입니다.
      다음 데이터를 바탕으로 한국어로 상세하고 유용한 분석 리포트를 작성해주세요.

      ${timeExplanation}

      **음성 채널 활동 데이터:**
      \`\`\`json
      ${JSON.stringify(summarizedData, null, 2)}
      \`\`\`

      **분석 내용에 포함할 것:**
      1. 📊 전체 활동 요약 (2-3문장)
      2. 🔍 주요 인사이트 (3-5개, 구체적인 수치 포함)
      3. 👥 활동적인 유저 분석 (TOP 3-5)
      4. 📺 채널 사용 패턴
      5. 🎤 마이크 사용 패턴
      6. 📈 트렌드 및 변화
      7. 💡 개선 제안 (실행 가능한 것)
      8. ⚠️ 주의사항 (있다면)

      **작성 규칙:**
      - 모든 시간은 "시간", "분" 단위로 변환
      - 이모지를 적절히 사용하여 가독성 향상
      - 구체적인 숫자와 비율 포함
      - 친근하고 이해하기 쉬운 표현 사용
      - 마크다운 형식으로 작성 (##, ###, - 등 사용)
      - 긍정적인 면과 개선점을 균형있게 다루기
      - 3000자 이내로 요약하기
      - discord embed에 붙여야하니 규격을 신경쓰기

      지금 분석을 시작해주세요:`;
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
  async analyzeSpecificUser(
    activityData: VoiceActivityData,
    targetUserId: string,
  ): Promise<string> {
    const userActivity = activityData.userActivities.find((u) => u.userId === targetUserId);

    if (!userActivity) {
      throw new Error('User not found in activity data');
    }

    const prompt = `
유저의 음성 채널 활동 패턴을 분석해주세요:

\`\`\`json
${JSON.stringify(userActivity, null, 2)}
\`\`\`

다음 형식으로 분석 결과를 작성해주세요:

**🎯 활동 수준:** [높음/보통/낮음]

**👤 활동 성향:**
[이 유저의 활동 패턴과 특징 설명]

**💪 강점:**
- [강점 1]
- [강점 2]

**⚠️ 주의사항:**
- [있다면 작성]

**💡 제안:**
- [제안 1]
- [제안 2]

간결하고 명확하게 작성해주세요.
`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Failed to analyze user', error);
      return '⚠️ 유저 분석 중 오류가 발생했습니다.';
    }
  }

  /**
   * 커뮤니티 건강도 점수 산출
   */
  async calculateCommunityHealth(activityData: VoiceActivityData): Promise<string> {
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
      recentTrends: activityData.dailyTrends.slice(-7),
    };

    const prompt = `
Discord 서버의 음성 채널 활동 데이터를 기반으로 커뮤니티 건강도를 분석해주세요.

데이터:
\`\`\`json
${JSON.stringify(summarizedData, null, 2)}
\`\`\`

다음 형식으로 분석 결과를 작성해주세요:

**🏥 건강도 점수: [0-100점]**

**📊 세부 평가:**
- 참여도: [평가]
- 성장세: [평가]
- 상호작용: [평가]
- 유지율: [평가]

**📝 종합 의견:**
[2-3문장으로 현재 상태 설명]

**💡 운영자를 위한 조언:**
[실질적인 조언]

간결하고 명확하게 작성해주세요.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return text;
    } catch (error) {
      this.logger.error('Failed to calculate health score:', (error as Error).message);
      return '⚠️ 건강도 분석 중 오류가 발생했습니다.';
    }
  }
}
