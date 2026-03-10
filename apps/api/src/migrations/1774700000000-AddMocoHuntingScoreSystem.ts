import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMocoHuntingScoreSystem1774700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. NewbieConfig — 점수/세션/리셋 관련 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        ADD COLUMN "mocoMinCoPresenceMin" integer NOT NULL DEFAULT 10,
        ADD COLUMN "mocoScorePerSession" integer NOT NULL DEFAULT 10,
        ADD COLUMN "mocoScorePerMinute" integer NOT NULL DEFAULT 1,
        ADD COLUMN "mocoScorePerUnique" integer NOT NULL DEFAULT 5,
        ADD COLUMN "mocoResetPeriod" character varying NOT NULL DEFAULT 'NONE',
        ADD COLUMN "mocoResetIntervalDays" integer,
        ADD COLUMN "mocoCurrentPeriodStart" character varying`,
    );

    // 2. NewbieMocoTemplate — 점수 산정 안내 템플릿 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_moco_template"
        ADD COLUMN "scoringTemplate" text`,
    );

    // 3. MocoHuntingSession 테이블 생성
    await queryRunner.query(
      `CREATE TABLE "public"."moco_hunting_session" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "hunterId" character varying NOT NULL,
        "channelId" character varying NOT NULL,
        "startedAt" TIMESTAMP NOT NULL,
        "endedAt" TIMESTAMP,
        "durationMin" integer,
        "newbieMemberIds" json NOT NULL,
        "isValid" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moco_hunting_session" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_moco_session_guild_hunter" ON "public"."moco_hunting_session" ("guildId", "hunterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_moco_session_guild_started" ON "public"."moco_hunting_session" ("guildId", "startedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_moco_session_guild_valid" ON "public"."moco_hunting_session" ("guildId", "isValid")`,
    );

    // 4. MocoHuntingDaily 테이블 생성
    await queryRunner.query(
      `CREATE TABLE "public"."moco_hunting_daily" (
        "guildId" character varying NOT NULL,
        "hunterId" character varying NOT NULL,
        "date" character varying(8) NOT NULL,
        "channelMinutes" integer NOT NULL DEFAULT 0,
        "sessionCount" integer NOT NULL DEFAULT 0,
        "uniqueNewbieCount" integer NOT NULL DEFAULT 0,
        "score" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_moco_hunting_daily" PRIMARY KEY ("guildId", "hunterId", "date")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_moco_daily_guild_date" ON "public"."moco_hunting_daily" ("guildId", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4. MocoHuntingDaily 삭제
    await queryRunner.query(
      `DROP INDEX "public"."IDX_moco_daily_guild_date"`,
    );
    await queryRunner.query(`DROP TABLE "public"."moco_hunting_daily"`);

    // 3. MocoHuntingSession 삭제
    await queryRunner.query(
      `DROP INDEX "public"."IDX_moco_session_guild_valid"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_moco_session_guild_started"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_moco_session_guild_hunter"`,
    );
    await queryRunner.query(`DROP TABLE "public"."moco_hunting_session"`);

    // 2. NewbieMocoTemplate — scoringTemplate 컬럼 삭제
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_moco_template" DROP COLUMN "scoringTemplate"`,
    );

    // 1. NewbieConfig — 점수/세션/리셋 관련 컬럼 삭제
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        DROP COLUMN "mocoCurrentPeriodStart",
        DROP COLUMN "mocoResetIntervalDays",
        DROP COLUMN "mocoResetPeriod",
        DROP COLUMN "mocoScorePerUnique",
        DROP COLUMN "mocoScorePerMinute",
        DROP COLUMN "mocoScorePerSession",
        DROP COLUMN "mocoMinCoPresenceMin"`,
    );
  }
}
