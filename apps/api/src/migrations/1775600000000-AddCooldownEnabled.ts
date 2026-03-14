import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCooldownEnabled1775600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "voice_health_config" ADD "isCooldownEnabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voice_health_config" DROP COLUMN "isCooldownEnabled"`);
  }
}
