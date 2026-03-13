import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAutoChannelEmbed1773300000000 implements MigrationInterface {
  name = 'AddAutoChannelEmbed1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auto_channel_config" ADD "embedTitle" character varying`);
    await queryRunner.query(`ALTER TABLE "auto_channel_config" ADD "embedColor" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auto_channel_config" DROP COLUMN "embedColor"`);
    await queryRunner.query(`ALTER TABLE "auto_channel_config" DROP COLUMN "embedTitle"`);
  }
}
