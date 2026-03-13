import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMissionMemberName1774900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."newbie_mission"
        ADD COLUMN "memberName" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "public"."newbie_mission"
        DROP COLUMN "memberName"
    `);
  }
}
