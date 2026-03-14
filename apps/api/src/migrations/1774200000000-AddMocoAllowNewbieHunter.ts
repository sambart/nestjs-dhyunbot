import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMocoAllowNewbieHunter1774200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config" ADD COLUMN "mocoAllowNewbieHunter" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config" DROP COLUMN "mocoAllowNewbieHunter"`,
    );
  }
}
