import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * 음악 기능 제거에 따라 music_channel_config 테이블과 인덱스를 삭제한다.
 * 기존 운영 DB의 잔여 테이블을 정리하며, 신규 DB에서는 IF EXISTS로 no-op 처리된다.
 */
export class DropMusicChannelConfig1777100000000 implements MigrationInterface {
  name = 'DropMusicChannelConfig1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_music_channel_config_channel"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_music_channel_config_guild"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "music_channel_config"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "music_channel_config" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "channelId" character varying NOT NULL,
        "messageId" character varying,
        "embedTitle" character varying,
        "embedDescription" text,
        "embedColor" character varying,
        "embedThumbnailUrl" character varying,
        "buttonConfig" jsonb NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_music_channel_config" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_music_channel_config_guild" ON "music_channel_config" ("guildId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_music_channel_config_channel" ON "music_channel_config" ("channelId")`,
    );
  }
}
