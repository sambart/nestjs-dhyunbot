import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddVoiceExtendedData1775900000000 implements MigrationInterface {
  name = 'AddVoiceExtendedData1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1: voice_daily 테이블에 streaming/video/deaf 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "voice_daily" ADD COLUMN "streamingSec" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "voice_daily" ADD COLUMN "videoOnSec" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "voice_daily" ADD COLUMN "deafSec" integer NOT NULL DEFAULT 0`,
    );

    // Phase 2: voice_game_activity 테이블 생성
    await queryRunner.query(
      `CREATE TABLE "voice_game_activity" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "userId" character varying NOT NULL, "channelId" character varying NOT NULL, "gameName" character varying NOT NULL, "applicationId" character varying, "startedAt" TIMESTAMP NOT NULL, "endedAt" TIMESTAMP, "durationMin" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_voice_game_activity" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_activity_guild_user" ON "voice_game_activity" ("guildId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_activity_guild_game" ON "voice_game_activity" ("guildId", "gameName")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_activity_guild_started" ON "voice_game_activity" ("guildId", "startedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_activity_started" ON "voice_game_activity" ("startedAt")`,
    );

    // Phase 2: voice_game_daily 테이블 생성
    await queryRunner.query(
      `CREATE TABLE "voice_game_daily" ("guildId" character varying NOT NULL, "userId" character varying NOT NULL, "gameName" character varying NOT NULL, "date" date NOT NULL, "totalMinutes" integer NOT NULL DEFAULT 0, "sessionCount" integer NOT NULL DEFAULT 0, "recordedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_voice_game_daily" PRIMARY KEY ("guildId", "userId", "gameName", "date"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_daily_guild_date" ON "voice_game_daily" ("guildId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_game_daily_guild_game_date" ON "voice_game_daily" ("guildId", "gameName", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_game_daily_guild_game_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_game_daily_guild_date"`);
    await queryRunner.query(`DROP TABLE "voice_game_daily"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_game_activity_started"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_game_activity_guild_started"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_game_activity_guild_game"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_game_activity_guild_user"`);
    await queryRunner.query(`DROP TABLE "voice_game_activity"`);
    await queryRunner.query(`ALTER TABLE "voice_daily" DROP COLUMN "deafSec"`);
    await queryRunner.query(`ALTER TABLE "voice_daily" DROP COLUMN "videoOnSec"`);
    await queryRunner.query(`ALTER TABLE "voice_daily" DROP COLUMN "streamingSec"`);
  }
}
