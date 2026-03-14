import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddVoiceCoPresence1775500000000 implements MigrationInterface {
  name = 'AddVoiceCoPresence1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "voice_co_presence_session" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "userId" character varying NOT NULL, "channelId" character varying NOT NULL, "startedAt" TIMESTAMP NOT NULL, "endedAt" TIMESTAMP NOT NULL, "durationMin" integer NOT NULL, "peerIds" json NOT NULL, "peerMinutes" json NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_voice_co_presence_session" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_session_ended" ON "voice_co_presence_session" ("endedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_session_guild_started" ON "voice_co_presence_session" ("guildId", "startedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_session_guild_user" ON "voice_co_presence_session" ("guildId", "userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "voice_co_presence_pair_daily" ("guildId" character varying NOT NULL, "userId" character varying NOT NULL, "peerId" character varying NOT NULL, "date" date NOT NULL, "minutes" integer NOT NULL DEFAULT '0', "sessionCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_voice_co_presence_pair_daily" PRIMARY KEY ("guildId", "userId", "peerId", "date"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_pair_guild_date" ON "voice_co_presence_pair_daily" ("guildId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_pair_guild_user_date" ON "voice_co_presence_pair_daily" ("guildId", "userId", "date")`,
    );

    await queryRunner.query(
      `CREATE TABLE "voice_co_presence_daily" ("guildId" character varying NOT NULL, "userId" character varying NOT NULL, "date" date NOT NULL, "channelMinutes" integer NOT NULL DEFAULT '0', "sessionCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_voice_co_presence_daily" PRIMARY KEY ("guildId", "userId", "date"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_daily_guild_date" ON "voice_co_presence_daily" ("guildId", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_daily_guild_date"`);
    await queryRunner.query(`DROP TABLE "voice_co_presence_daily"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_pair_guild_user_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_pair_guild_date"`);
    await queryRunner.query(`DROP TABLE "voice_co_presence_pair_daily"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_session_guild_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_session_guild_started"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_copresence_session_ended"`);
    await queryRunner.query(`DROP TABLE "voice_co_presence_session"`);
  }
}
