import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddActionKickEnum1775400000000 implements MigrationInterface {
  name = 'AddActionKickEnum1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."inactive_member_action_log_actiontype_enum" ADD VALUE IF NOT EXISTS 'ACTION_KICK'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
    // To fully revert, the enum would need to be recreated without ACTION_KICK.
  }
}
