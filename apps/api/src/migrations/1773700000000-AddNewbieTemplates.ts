import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewbieTemplates1773700000000 implements MigrationInterface {
    name = 'AddNewbieTemplates1773700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // NewbieMissionTemplate
        await queryRunner.query(`CREATE TABLE "newbie_mission_template" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "titleTemplate" character varying, "headerTemplate" text, "itemTemplate" text, "footerTemplate" character varying, "statusMapping" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newbie_mission_template" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_newbie_mission_template_guild" ON "newbie_mission_template" ("guildId")`);

        // NewbieMocoTemplate
        await queryRunner.query(`CREATE TABLE "newbie_moco_template" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "titleTemplate" character varying, "bodyTemplate" text, "itemTemplate" character varying, "footerTemplate" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newbie_moco_template" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_newbie_moco_template_guild" ON "newbie_moco_template" ("guildId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_newbie_moco_template_guild"`);
        await queryRunner.query(`DROP TABLE "newbie_moco_template"`);

        await queryRunner.query(`DROP INDEX "public"."UQ_newbie_mission_template_guild"`);
        await queryRunner.query(`DROP TABLE "newbie_mission_template"`);
    }

}
