import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class DropGuildCoPresenceConfig1777200000000 implements MigrationInterface {
  name = 'DropGuildCoPresenceConfig1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guild_co_presence_config"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
