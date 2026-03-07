import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAutoChannel1772905024511 implements MigrationInterface {
    name = 'AddAutoChannel1772905024511'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auto_channel_config" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "triggerChannelId" character varying NOT NULL, "waitingRoomTemplate" character varying NOT NULL, "guideMessage" text NOT NULL, "guideMessageId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_939971fcc693848f67a0be8702b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_auto_channel_config_guild_trigger" ON "auto_channel_config" ("guildId", "triggerChannelId") `);
        await queryRunner.query(`CREATE TABLE "auto_channel_button" ("id" SERIAL NOT NULL, "configId" integer NOT NULL, "label" character varying NOT NULL, "emoji" character varying, "targetCategoryId" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a39c475fb99bef243ac3211949c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_auto_channel_button_config" ON "auto_channel_button" ("configId") `);
        await queryRunner.query(`CREATE TABLE "auto_channel_sub_option" ("id" SERIAL NOT NULL, "buttonId" integer NOT NULL, "label" character varying NOT NULL, "emoji" character varying, "channelSuffix" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_fab19d1dbbef8629ab465beea45" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_auto_channel_sub_option_button" ON "auto_channel_sub_option" ("buttonId") `);
        await queryRunner.query(`ALTER TABLE "auto_channel_button" ADD CONSTRAINT "FK_c08ef86897f6ab47b41f537f14d" FOREIGN KEY ("configId") REFERENCES "auto_channel_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auto_channel_sub_option" ADD CONSTRAINT "FK_82e02cd27636acd908b219d92e8" FOREIGN KEY ("buttonId") REFERENCES "auto_channel_button"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auto_channel_sub_option" DROP CONSTRAINT "FK_82e02cd27636acd908b219d92e8"`);
        await queryRunner.query(`ALTER TABLE "auto_channel_button" DROP CONSTRAINT "FK_c08ef86897f6ab47b41f537f14d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_auto_channel_sub_option_button"`);
        await queryRunner.query(`DROP TABLE "auto_channel_sub_option"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_auto_channel_button_config"`);
        await queryRunner.query(`DROP TABLE "auto_channel_button"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_auto_channel_config_guild_trigger"`);
        await queryRunner.query(`DROP TABLE "auto_channel_config"`);
    }

}
