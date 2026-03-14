import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMissionStatusLeft1774800100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "newbie_mission_status_enum" ADD VALUE IF NOT EXISTS 'LEFT'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values
  }
}
