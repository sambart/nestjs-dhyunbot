import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMocoPlayCountOptions1775000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        ADD COLUMN "mocoPlayCountMinDurationMin" integer,
        ADD COLUMN "mocoPlayCountIntervalMin" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."newbie_config"
        DROP COLUMN "mocoPlayCountIntervalMin",
        DROP COLUMN "mocoPlayCountMinDurationMin"`,
    );
  }
}
