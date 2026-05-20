import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddBestFriendCanvasConfig1777100000000 implements MigrationInterface {
  name = 'AddBestFriendCanvasConfig1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_privacy_config" (
        "guildId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "disableRelationshipShare" boolean NOT NULL DEFAULT false,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_privacy_config" PRIMARY KEY ("guildId", "userId")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_user_privacy_config_user" ON "user_privacy_config" ("userId")`,
    );

    await queryRunner.query(
      `COMMENT ON TABLE "user_privacy_config" IS '사용자별 길드 단위 친밀도·베스트 프렌드 노출 opt-out 설정 (Phase 5)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_privacy_config"."guildId" IS '디스코드 서버 ID (복합 PK 선두)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_privacy_config"."userId" IS '사용자 디스코드 ID (복합 PK 후미)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_privacy_config"."disableRelationshipShare" IS 'true = 친밀도·베프 노출 비공개(opt-out). 타인 조회 시 익명화(???) 처리됨. 기본값 false(공개)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_privacy_config"."updatedAt" IS '마지막 설정 변경 시각'`,
    );

    await queryRunner.query(
      `CREATE TABLE "guild_co_presence_config" (
        "guildId" character varying NOT NULL,
        "allowPublicAffinityQuery" boolean NOT NULL DEFAULT false,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_co_presence_config" PRIMARY KEY ("guildId")
      )`,
    );

    await queryRunner.query(
      `COMMENT ON TABLE "guild_co_presence_config" IS '길드 단위 Co-Presence 공개 설정 — 타인↔타인 /affinity 조회 허용 여부 (Phase 5)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "guild_co_presence_config"."guildId" IS '디스코드 서버 ID (PK)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "guild_co_presence_config"."allowPublicAffinityQuery" IS 'true = 일반 사용자도 본인 미포함 타인↔타인 /affinity 조회 허용. false(기본) = ManageGuild 권한 보유자만 허용'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "guild_co_presence_config"."updatedAt" IS '마지막 설정 변경 시각'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guild_co_presence_config"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_privacy_config_user"`);
    await queryRunner.query(`DROP TABLE "user_privacy_config"`);
  }
}
