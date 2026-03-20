export interface VoiceSession {
  channelId: string; // 현재 채널
  joinedAt: number; // 채널에 들어온 시점 timestamp(ms)
  mic: boolean; // 마이크 상태
  alone: boolean; // 혼자인지 여부
  lastUpdatedAt: number; // duration 계산 마지막 시점
  date: string; // ⭐ YYYYMMDD
  streaming: boolean; // 화면 공유 상태
  videoOn: boolean; // 카메라 상태
  selfDeaf: boolean; // 스피커 음소거 상태
}
