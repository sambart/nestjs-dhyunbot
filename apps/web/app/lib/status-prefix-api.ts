// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** 버튼 타입 — PRD StatusPrefixButton.type enum과 일치 */
export type StatusPrefixButtonType = 'PREFIX' | 'RESET';

/**
 * 버튼 항목 타입.
 * - id: 기존 DB 항목은 양의 정수, 신규 항목(아직 미저장)은 음의 정수 임시 키 사용
 * - prefix: type === 'RESET'일 때 null
 */
export interface StatusPrefixButton {
  id: number;
  label: string;
  emoji: string | null;
  prefix: string | null;
  type: StatusPrefixButtonType;
  sortOrder: number;
}

/** 설정 전체 (GET 응답 및 POST 요청 바디) */
export interface StatusPrefixConfig {
  enabled: boolean;
  channelId: string | null;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  prefixTemplate: string;
  buttons: StatusPrefixButton[];
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

import { ApiError, apiClient } from './api-client';

/**
 * 현재 서버의 Status Prefix 설정을 조회한다.
 * 설정이 없으면 null을 반환한다 (백엔드가 404를 반환하는 경우 처리).
 */
export async function fetchStatusPrefixConfig(
  guildId: string,
): Promise<StatusPrefixConfig | null> {
  try {
    return await apiClient<StatusPrefixConfig>(`/api/guilds/${guildId}/status-prefix/config`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Status Prefix 설정을 저장한다.
 * 버튼 목록 전체를 배열로 일괄 전송한다.
 */
export async function saveStatusPrefixConfig(
  guildId: string,
  config: StatusPrefixConfig,
): Promise<void> {
  await apiClient<void>(`/api/guilds/${guildId}/status-prefix/config`, {
    method: 'POST',
    body: config,
  });
}
