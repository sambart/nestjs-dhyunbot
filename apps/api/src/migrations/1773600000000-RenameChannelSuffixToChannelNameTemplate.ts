import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameChannelSuffixToChannelNameTemplate1773600000000
  implements MigrationInterface
{
  name = 'RenameChannelSuffixToChannelNameTemplate1773600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_sub_option" RENAME COLUMN "channelSuffix" TO "channelNameTemplate"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_channel_sub_option" RENAME COLUMN "channelNameTemplate" TO "channelSuffix"`,
    );
  }
}
