import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PairDailyUnidirectional1776000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 임시 테이블에 단방향 병합 결과 저장
    await queryRunner.query(`
      CREATE TEMP TABLE _pair_daily_merged AS
      SELECT
        "guildId",
        LEAST("userId", "peerId") AS "userId",
        GREATEST("userId", "peerId") AS "peerId",
        "date",
        SUM("minutes") AS "minutes",
        SUM("sessionCount") AS "sessionCount",
        MAX("recordedAt") AS "recordedAt"
      FROM "voice_co_presence_pair_daily"
      WHERE "userId" != "peerId"
      GROUP BY "guildId", LEAST("userId", "peerId"), GREATEST("userId", "peerId"), "date"
    `);

    // 2. 기존 테이블 truncate
    await queryRunner.query(`TRUNCATE TABLE "voice_co_presence_pair_daily"`);

    // 3. 병합 결과 삽입
    await queryRunner.query(`
      INSERT INTO "voice_co_presence_pair_daily"
        ("guildId", "userId", "peerId", "date", "minutes", "sessionCount", "recordedAt")
      SELECT
        "guildId", "userId", "peerId", "date",
        "minutes" / 2, "sessionCount" / 2, "recordedAt"
      FROM _pair_daily_merged
    `);

    // 4. 임시 테이블 제거
    await queryRunner.query(`DROP TABLE _pair_daily_merged`);

    // 5. userId < peerId 제약 추가 (향후 양방향 삽입 방지)
    await queryRunner.query(`
      ALTER TABLE "voice_co_presence_pair_daily"
      ADD CONSTRAINT "CHK_pair_daily_unidirectional" CHECK ("userId" < "peerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 제약 제거
    await queryRunner.query(`
      ALTER TABLE "voice_co_presence_pair_daily"
      DROP CONSTRAINT IF EXISTS "CHK_pair_daily_unidirectional"
    `);

    // 단방향 → 양방향 복원 (현재 데이터를 역방향으로 복제)
    await queryRunner.query(`
      INSERT INTO "voice_co_presence_pair_daily"
        ("guildId", "userId", "peerId", "date", "minutes", "sessionCount", "recordedAt")
      SELECT
        "guildId", "peerId", "userId", "date", "minutes", "sessionCount", "recordedAt"
      FROM "voice_co_presence_pair_daily"
      ON CONFLICT ("guildId", "userId", "peerId", "date") DO NOTHING
    `);
  }
}
