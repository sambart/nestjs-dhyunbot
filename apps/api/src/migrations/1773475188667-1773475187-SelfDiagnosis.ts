import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class SelfDiagnosis1773475188667 implements MigrationInterface {
  name = 'SelfDiagnosis1773475188667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "voice_health_config" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "isEnabled" boolean NOT NULL DEFAULT false,
        "analysisDays" integer NOT NULL DEFAULT 30,
        "cooldownHours" integer NOT NULL DEFAULT 24,
        "isLlmSummaryEnabled" boolean NOT NULL DEFAULT false,
        "minActivityMinutes" integer NOT NULL DEFAULT 600,
        "minActiveDaysRatio" numeric(3,2) NOT NULL DEFAULT 0.50,
        "hhiThreshold" numeric(3,2) NOT NULL DEFAULT 0.30,
        "minPeerCount" integer NOT NULL DEFAULT 3,
        "badgeActivityTopPercent" integer NOT NULL DEFAULT 10,
        "badgeSocialHhiMax" numeric(3,2) NOT NULL DEFAULT 0.25,
        "badgeSocialMinPeers" integer NOT NULL DEFAULT 5,
        "badgeHunterTopPercent" integer NOT NULL DEFAULT 10,
        "badgeConsistentMinRatio" numeric(3,2) NOT NULL DEFAULT 0.80,
        "badgeMicMinRate" numeric(3,2) NOT NULL DEFAULT 0.70,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voice_health_config" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voice_health_config_guild" ON "voice_health_config" ("guildId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "voice_health_badge" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "badges" json NOT NULL DEFAULT '[]',
        "activityRank" integer,
        "activityTopPercent" numeric(5,2),
        "hhiScore" numeric(4,3),
        "mocoRank" integer,
        "mocoTopPercent" numeric(5,2),
        "micUsageRate" numeric(4,3),
        "activeDaysRatio" numeric(3,2),
        "calculatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voice_health_badge" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voice_health_badge_guild_user" ON "voice_health_badge" ("guildId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_health_badge_guild" ON "voice_health_badge" ("guildId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_voice_health_badge_guild"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_voice_health_badge_guild_user"`);
    await queryRunner.query(`DROP TABLE "voice_health_badge"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_voice_health_config_guild"`);
    await queryRunner.query(`DROP TABLE "voice_health_config"`);
  }
}
