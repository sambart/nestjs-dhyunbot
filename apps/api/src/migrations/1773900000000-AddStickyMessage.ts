import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStickyMessage1773900000000 implements MigrationInterface {
    name = 'AddStickyMessage1773900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sticky_message_config" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "channelId" character varying NOT NULL, "embedTitle" character varying, "embedDescription" text, "embedColor" character varying, "messageId" character varying, "enabled" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_sticky_message_config" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sticky_message_guild" ON "sticky_message_config" ("guildId") `);
        await queryRunner.query(`CREATE INDEX "IDX_sticky_message_guild_channel_sort" ON "sticky_message_config" ("guildId", "channelId", "sortOrder") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_sticky_message_guild_channel_sort"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sticky_message_guild"`);
        await queryRunner.query(`DROP TABLE "sticky_message_config"`);
    }

}
