import { apiClient } from './api-client';

/** GET /api/users/me/privacy 응답 */
export interface UserPrivacyConfig {
  guildId: string;
  userId: string;
  disableRelationshipShare: boolean;
}

/** PUT /api/users/me/privacy 요청 본문 */
export interface UserPrivacySaveDto {
  guildId: string;
  disableRelationshipShare: boolean;
}

/**
 * 사용자 본인의 사생활 설정을 특정 길드 기준으로 조회한다.
 * @param guildId 조회할 길드 ID
 */
export async function fetchUserPrivacy(guildId: string): Promise<UserPrivacyConfig> {
  return apiClient<UserPrivacyConfig>(
    `/api/users/me/privacy?guildId=${encodeURIComponent(guildId)}`,
  );
}

/**
 * 사용자 본인의 사생활 설정을 저장한다.
 * @param guildId 저장할 길드 ID
 * @param dto 저장할 설정 DTO
 */
export async function saveUserPrivacy(
  guildId: string,
  dto: UserPrivacySaveDto,
): Promise<UserPrivacyConfig> {
  return apiClient<UserPrivacyConfig>(
    `/api/users/me/privacy?guildId=${encodeURIComponent(guildId)}`,
    { method: 'PUT', body: dto },
  );
}
