import { IsBoolean, IsString } from 'class-validator';

/** 웹 API `PUT /api/users/me/privacy` 요청 본문 DTO */
export class UpdateUserPrivacyDto {
  @IsString()
  guildId: string;

  @IsBoolean()
  disableRelationshipShare: boolean;
}

/** 웹 API `GET/PUT /api/users/me/privacy` 응답 DTO */
export class UserPrivacyDto {
  guildId: string;
  userId: string;
  disableRelationshipShare: boolean;
}

/** Bot API 전용 — `/privacy` 슬래시 커맨드에서 호출 */
export class BotUpsertPrivacyDto {
  @IsString()
  guildId: string;

  @IsString()
  userId: string;

  @IsBoolean()
  disableRelationshipShare: boolean;
}
