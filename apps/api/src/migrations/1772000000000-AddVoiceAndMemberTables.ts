import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoiceAndMemberTables1772000000000 implements MigrationInterface {
  name = 'AddVoiceAndMemberTables1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // channel_status enum
    await queryRunner.query(
      `CREATE TYPE "public"."channel_status_enum" AS ENUM('ACTIVE', 'DELETED')`,
    );

    // channel
    await queryRunner.query(
      `CREATE TABLE "public"."channel" (
        "id" SERIAL NOT NULL,
        "discordChannelId" character varying NOT NULL,
        "channelName" character varying NOT NULL,
        "status" "public"."channel_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_channel_discordChannelId" UNIQUE ("discordChannelId"),
        CONSTRAINT "PK_channel" PRIMARY KEY ("id")
      )`,
    );

    // member
    await queryRunner.query(
      `CREATE TABLE "public"."member" (
        "id" SERIAL NOT NULL,
        "discordMemberId" character varying NOT NULL,
        "nickName" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_member_discordMemberId" UNIQUE ("discordMemberId"),
        CONSTRAINT "PK_member" PRIMARY KEY ("id")
      )`,
    );

    // voice_channel_history
    await queryRunner.query(
      `CREATE TABLE "public"."voice_channel_history" (
        "id" SERIAL NOT NULL,
        "joinAt" TIMESTAMP NOT NULL,
        "leftAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "channelId" integer,
        "memberId" integer,
        CONSTRAINT "PK_voice_channel_history" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "public"."voice_channel_history"
        ADD CONSTRAINT "FK_vch_channel" FOREIGN KEY ("channelId") REFERENCES "public"."channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "public"."voice_channel_history"
        ADD CONSTRAINT "FK_vch_member" FOREIGN KEY ("memberId") REFERENCES "public"."member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // voice_daily
    await queryRunner.query(
      `CREATE TABLE "public"."voice_daily" (
        "guildId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "date" character varying NOT NULL,
        "channelId" character varying NOT NULL,
        "channelName" character varying NOT NULL DEFAULT '',
        "userName" character varying NOT NULL DEFAULT '',
        "channelDurationSec" integer NOT NULL DEFAULT 0,
        "micOnSec" integer NOT NULL DEFAULT 0,
        "micOffSec" integer NOT NULL DEFAULT 0,
        "aloneSec" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_voice_daily" PRIMARY KEY ("guildId", "userId", "date", "channelId")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_voice_daily_guild_date" ON "public"."voice_daily" ("guildId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_daily_guild_channel_date" ON "public"."voice_daily" ("guildId", "channelId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_daily_guild_user_date" ON "public"."voice_daily" ("guildId", "userId", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_voice_daily_guild_user_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_voice_daily_guild_channel_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_voice_daily_guild_date"`);
    await queryRunner.query(`DROP TABLE "public"."voice_daily"`);
    await queryRunner.query(
      `ALTER TABLE "public"."voice_channel_history" DROP CONSTRAINT "FK_vch_member"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."voice_channel_history" DROP CONSTRAINT "FK_vch_channel"`,
    );
    await queryRunner.query(`DROP TABLE "public"."voice_channel_history"`);
    await queryRunner.query(`DROP TABLE "public"."member"`);
    await queryRunner.query(`DROP TABLE "public"."channel"`);
    await queryRunner.query(`DROP TYPE "public"."channel_status_enum"`);
  }
}
