import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelGuildIdAndHistoryIndex1774400000000
  implements MigrationInterface
{
  name = 'AddChannelGuildIdAndHistoryIndex1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Channel 테이블에 guildId 컬럼 추가 (NULLABLE — 기존 레코드 호환)
    await queryRunner.query(
      `ALTER TABLE "public"."channel" ADD "guildId" character varying`,
    );

    // Channel.guildId 인덱스 추가
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_guild" ON "public"."channel" ("guildId")`,
    );

    // VoiceChannelHistory 멤버+입장시각 복합 인덱스 추가
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_channel_history_member_join" ON "public"."voice_channel_history" ("memberId", "joinAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_voice_channel_history_member_join"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_channel_guild"`);
    await queryRunner.query(
      `ALTER TABLE "public"."channel" DROP COLUMN "guildId"`,
    );
  }
}
