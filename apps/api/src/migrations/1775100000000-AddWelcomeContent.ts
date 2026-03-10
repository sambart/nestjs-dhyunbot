import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWelcomeContent1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        ADD COLUMN "welcomeContent" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        DROP COLUMN "welcomeContent"`,
    );
  }
}
