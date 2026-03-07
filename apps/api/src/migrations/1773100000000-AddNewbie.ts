import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewbie1773100000000 implements MigrationInterface {
    name = 'AddNewbie1773100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // NewbieConfig
        await queryRunner.query(`CREATE TABLE "newbie_config" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "welcomeEnabled" boolean NOT NULL DEFAULT false, "welcomeChannelId" character varying, "welcomeEmbedTitle" character varying, "welcomeEmbedDescription" text, "welcomeEmbedColor" character varying, "welcomeEmbedThumbnailUrl" character varying, "missionEnabled" boolean NOT NULL DEFAULT false, "missionDurationDays" integer, "missionTargetPlaytimeHours" integer, "missionNotifyChannelId" character varying, "missionNotifyMessageId" character varying, "mocoEnabled" boolean NOT NULL DEFAULT false, "mocoRankChannelId" character varying, "mocoRankMessageId" character varying, "mocoAutoRefreshMinutes" integer, "roleEnabled" boolean NOT NULL DEFAULT false, "roleDurationDays" integer, "newbieRoleId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newbie_config" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_newbie_config_guild" ON "newbie_config" ("guildId")`);

        // NewbieMission
        await queryRunner.query(`CREATE TYPE "public"."newbie_mission_status_enum" AS ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "newbie_mission" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "memberId" character varying NOT NULL, "startDate" character varying NOT NULL, "endDate" character varying NOT NULL, "targetPlaytimeSec" integer NOT NULL, "status" "public"."newbie_mission_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newbie_mission" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_mission_guild_member" ON "newbie_mission" ("guildId", "memberId")`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_mission_guild_status" ON "newbie_mission" ("guildId", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_mission_status_end_date" ON "newbie_mission" ("status", "endDate")`);

        // NewbiePeriod
        await queryRunner.query(`CREATE TABLE "newbie_period" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "memberId" character varying NOT NULL, "startDate" character varying NOT NULL, "expiresDate" character varying NOT NULL, "isExpired" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newbie_period" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_period_guild_member" ON "newbie_period" ("guildId", "memberId")`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_period_expires" ON "newbie_period" ("expiresDate", "isExpired")`);
        await queryRunner.query(`CREATE INDEX "IDX_newbie_period_guild_active" ON "newbie_period" ("guildId", "isExpired")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_period_guild_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_period_expires"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_period_guild_member"`);
        await queryRunner.query(`DROP TABLE "newbie_period"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_mission_status_end_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_mission_guild_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newbie_mission_guild_member"`);
        await queryRunner.query(`DROP TABLE "newbie_mission"`);
        await queryRunner.query(`DROP TYPE "public"."newbie_mission_status_enum"`);

        await queryRunner.query(`DROP INDEX "public"."UQ_newbie_config_guild"`);
        await queryRunner.query(`DROP TABLE "newbie_config"`);
    }

}
