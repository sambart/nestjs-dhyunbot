import { Inject, Injectable, Logger } from '@nestjs/common';
import { VoiceActivityData, VoiceAnalysisResult } from '@onyu/shared';

import type { LlmProvider } from '../../common/llm/llm-provider.interface';
import { LLM_PROVIDER } from '../../common/llm/llm-provider.interface';
import { getErrorMessage, getErrorStack } from '../../common/util/error.util';

@Injectable()
export class VoiceAiAnalysisService {
  private readonly logger = new Logger(VoiceAiAnalysisService.name);

  constructor(@Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider) {}

  async analyzeVoiceActivity(activityData: VoiceActivityData): Promise<VoiceAnalysisResult> {
    try {
      const prompt = this.buildVoiceAnalysisPrompt(activityData);

      this.logger.log('Sending voice activity data to LLM...');
      const text = await this.llmProvider.generateText(prompt);

      this.logger.log('Successfully analyzed voice activity');
      return { text };
    } catch (error) {
      this.logger.error('Failed to analyze voice activity after retries', getErrorStack(error));
      return {
        text: this.buildFallbackAnalysis(activityData),
      };
    }
  }

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

  private buildFallbackAnalysis(data: VoiceActivityData): string {
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
    };

    const topUsers = data.userActivities
      .slice(0, 5)
      .map((u, i) => `${i + 1}. **${u.username}** — ${formatTime(u.totalVoiceTime)}`)
      .join('\n');

    const topChannels = data.channelStats
      .slice(0, 3)
      .map((c) => `- **${c.channelName}** — ${formatTime(c.totalVoiceTime)} (${c.uniqueUsers}명)`)
      .join('\n');

    return (
      '> AI 분석을 일시적으로 사용할 수 없어 기본 통계를 표시합니다.\n\n' +
      `**📊 전체 통계**\n` +
      `- 총 활성 유저: ${data.totalStats.totalUsers}명\n` +
      `- 총 음성 시간: ${formatTime(data.totalStats.totalVoiceTime)}\n` +
      `- 총 마이크 사용: ${formatTime(data.totalStats.totalMicOnTime)}\n` +
      `- 일평균 활성 유저: ${data.totalStats.avgDailyActiveUsers}명\n\n` +
      `**👥 TOP 5 유저**\n${topUsers || '- 데이터 없음'}\n\n` +
      `**📺 인기 채널**\n${topChannels || '- 데이터 없음'}`
    );
  }

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
      return await this.llmProvider.generateText(prompt);
    } catch (error) {
      this.logger.error('Failed to analyze user after retries', getErrorStack(error));
      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      };

      return (
        '> AI 분석을 일시적으로 사용할 수 없어 기본 통계를 표시합니다.\n\n' +
        `- 총 음성 시간: ${formatTime(userActivity.totalVoiceTime)}\n` +
        `- 마이크 사용률: ${userActivity.micUsageRate}%\n` +
        `- 활동 일수: ${userActivity.activeDays}일\n` +
        `- 자주 사용 채널: ${
          userActivity.activeChannels
            .slice(0, 3)
            .map((c) => c.channelName)
            .join(', ') || '없음'
        }`
      );
    }
  }

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
      return await this.llmProvider.generateText(prompt);
    } catch (error) {
      this.logger.error('Failed to calculate health score after retries:', getErrorMessage(error));
      return (
        '> AI 분석을 일시적으로 사용할 수 없어 기본 통계를 표시합니다.\n\n' +
        `- 총 활성 유저: ${activityData.totalStats.totalUsers}명\n` +
        `- 일평균 활성 유저: ${activityData.totalStats.avgDailyActiveUsers}명\n` +
        `- 총 음성 시간: ${Math.floor(activityData.totalStats.totalVoiceTime / 3600)}시간`
      );
    }
  }
}
