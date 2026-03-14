import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddStatusPrefix1773200000000 implements MigrationInterface {
  name = 'AddStatusPrefix1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "status_prefix_config" ("id" SERIAL NOT NULL, "guildId" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "channelId" character varying, "messageId" character varying, "embedTitle" character varying, "embedDescription" text, "embedColor" character varying, "prefixTemplate" character varying NOT NULL DEFAULT '[{prefix}] {nickname}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_status_prefix_config" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_status_prefix_config_guild" ON "status_prefix_config" ("guildId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."status_prefix_button_type_enum" AS ENUM('PREFIX', 'RESET')`,
    );
    await queryRunner.query(
      `CREATE TABLE "status_prefix_button" ("id" SERIAL NOT NULL, "configId" integer NOT NULL, "label" character varying NOT NULL, "emoji" character varying, "prefix" character varying, "type" "public"."status_prefix_button_type_enum" NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_status_prefix_button" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_status_prefix_button_config" ON "status_prefix_button" ("configId", "sortOrder") `,
    );
    await queryRunner.query(
      `ALTER TABLE "status_prefix_button" ADD CONSTRAINT "FK_status_prefix_button_config" FOREIGN KEY ("configId") REFERENCES "status_prefix_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "status_prefix_button" DROP CONSTRAINT "FK_status_prefix_button_config"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_status_prefix_button_config"`);
    await queryRunner.query(`DROP TABLE "status_prefix_button"`);
    await queryRunner.query(`DROP TYPE "public"."status_prefix_button_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_status_prefix_config_guild"`);
    await queryRunner.query(`DROP TABLE "status_prefix_config"`);
  }
}
