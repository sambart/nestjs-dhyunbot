export class VoiceHistoryItemDto {
  id: number;
  channelId: string;
  channelName: string;
  categoryId: string | null;
  categoryName: string | null;
  joinAt: string;        // ISO 8601 문자열
  leftAt: string | null; // null이면 아직 퇴장 전
  durationSec: number | null;
}

export class VoiceHistoryPageDto {
  total: number;
  page: number;
  limit: number;
  items: VoiceHistoryItemDto[];
}
