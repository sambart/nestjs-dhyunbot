import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddChannelNameTemplate1773500000001 implements MigrationInterface {
  name = 'AddChannelNameTemplate1773500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_button" ADD "channelNameTemplate" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auto_channel_button" DROP COLUMN "channelNameTemplate"`);
  }
}
