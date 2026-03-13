import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddNameToAutoChannelConfig1773800000000 implements MigrationInterface {
  name = 'AddNameToAutoChannelConfig1773800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_config" ADD "name" character varying NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auto_channel_config" DROP COLUMN "name"`);
  }
}
