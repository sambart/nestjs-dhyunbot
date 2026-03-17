export interface VoiceGameSession {
  gameName: string;
  applicationId: string | null;
  startedAt: number; // timestamp (ms)
  channelId: string; // 게임 활동 중이던 음성 채널 ID
}
