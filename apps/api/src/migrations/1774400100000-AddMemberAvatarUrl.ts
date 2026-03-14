import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMemberAvatarUrl1774400100000 implements MigrationInterface {
  name = 'AddMemberAvatarUrl1774400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."member" ADD "avatarUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."member" DROP COLUMN "avatarUrl"`);
  }
}
