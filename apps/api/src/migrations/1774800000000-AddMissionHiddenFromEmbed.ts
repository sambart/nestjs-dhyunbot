import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissionHiddenFromEmbed1774800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."newbie_mission"
        ADD COLUMN "hiddenFromEmbed" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."newbie_mission"
        DROP COLUMN "hiddenFromEmbed"
    `);
  }
}
