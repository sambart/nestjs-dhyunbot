import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryColumns1774500000000 implements MigrationInterface {
  name = 'AddCategoryColumns1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Channel 테이블에 categoryId, categoryName 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "public"."channel" ADD "categoryId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."channel" ADD "categoryName" character varying`,
    );

    // VoiceDailyEntity 테이블에 categoryId, categoryName 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "public"."voice_daily" ADD "categoryId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."voice_daily" ADD "categoryName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."voice_daily" DROP COLUMN "categoryName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."voice_daily" DROP COLUMN "categoryId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."channel" DROP COLUMN "categoryName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."channel" DROP COLUMN "categoryId"`,
    );
  }
}
