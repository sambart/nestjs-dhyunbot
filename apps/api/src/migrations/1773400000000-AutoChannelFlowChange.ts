import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AutoChannelFlowChange1773400000000 implements MigrationInterface {
  name = 'AutoChannelFlowChange1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_config" ADD "guideChannelId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_channel_config" ALTER COLUMN "waitingRoomTemplate" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_config" ALTER COLUMN "waitingRoomTemplate" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "auto_channel_config" DROP COLUMN "guideChannelId"`);
  }
}
