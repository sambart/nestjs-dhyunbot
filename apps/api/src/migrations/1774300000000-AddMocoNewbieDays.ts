import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMocoNewbieDays1774300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config" ADD COLUMN IF NOT EXISTS "mocoNewbieDays" integer NOT NULL DEFAULT 30`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."newbie_config" DROP COLUMN "mocoNewbieDays"`);
  }
}
