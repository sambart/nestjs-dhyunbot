import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddRecordedAtColumns1775800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voice_daily" ADD COLUMN "recordedAt" TIMESTAMPTZ`);
    await queryRunner.query(
      `ALTER TABLE "voice_co_presence_pair_daily" ADD COLUMN "recordedAt" TIMESTAMPTZ`,
    );

    // Backfill existing data: YYYYMMDD + KST → TIMESTAMPTZ
    await queryRunner.query(
      `UPDATE "voice_daily" SET "recordedAt" = TO_TIMESTAMP(date, 'YYYYMMDD') AT TIME ZONE 'Asia/Seoul' WHERE "recordedAt" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "voice_co_presence_pair_daily" SET "recordedAt" = date::timestamp AT TIME ZONE 'Asia/Seoul' WHERE "recordedAt" IS NULL`,
    );

    // Add index for timezone-based queries
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_daily_guild_recordedAt" ON "voice_daily" ("guildId", "recordedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copresence_pair_guild_recordedAt" ON "voice_co_presence_pair_daily" ("guildId", "recordedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_copresence_pair_guild_recordedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_voice_daily_guild_recordedAt"`);
    await queryRunner.query(`ALTER TABLE "voice_co_presence_pair_daily" DROP COLUMN "recordedAt"`);
    await queryRunner.query(`ALTER TABLE "voice_daily" DROP COLUMN "recordedAt"`);
  }
}
