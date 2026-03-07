import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissionMocoEmbedFields1773500000000 implements MigrationInterface {
  name = 'AddMissionMocoEmbedFields1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "newbie_config" ADD "missionEmbedTitle" character varying`);
    await queryRunner.query(`ALTER TABLE "newbie_config" ADD "missionEmbedColor" character varying`);
    await queryRunner.query(
      `ALTER TABLE "newbie_config" ADD "missionEmbedThumbnailUrl" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "newbie_config" ADD "mocoEmbedTitle" character varying`);
    await queryRunner.query(`ALTER TABLE "newbie_config" ADD "mocoEmbedColor" character varying`);
    await queryRunner.query(
      `ALTER TABLE "newbie_config" ADD "mocoEmbedThumbnailUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "mocoEmbedThumbnailUrl"`);
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "mocoEmbedColor"`);
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "mocoEmbedTitle"`);
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "missionEmbedThumbnailUrl"`);
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "missionEmbedColor"`);
    await queryRunner.query(`ALTER TABLE "newbie_config" DROP COLUMN "missionEmbedTitle"`);
  }
}
