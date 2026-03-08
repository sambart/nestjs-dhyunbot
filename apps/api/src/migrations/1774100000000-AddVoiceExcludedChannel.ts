import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoiceExcludedChannel1774100000000 implements MigrationInterface {
    name = 'AddVoiceExcludedChannel1774100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."voice_excluded_channel_type_enum" AS ENUM('CHANNEL', 'CATEGORY')`);
        await queryRunner.query(`CREATE TABLE "voice_excluded_channel" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "discordChannelId" character varying NOT NULL, "type" "public"."voice_excluded_channel_type_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_voice_excluded_channel_guild_discord" UNIQUE ("guildId", "discordChannelId"), CONSTRAINT "PK_voice_excluded_channel" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "voice_excluded_channel"`);
        await queryRunner.query(`DROP TYPE "public"."voice_excluded_channel_type_enum"`);
    }

}
