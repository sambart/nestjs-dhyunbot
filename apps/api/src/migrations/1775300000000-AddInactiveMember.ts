import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddInactiveMember1775300000000 implements MigrationInterface {
  name = 'AddInactiveMember1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum types
    await queryRunner.query(
      `CREATE TYPE "public"."inactive_member_record_grade_enum" AS ENUM('FULLY_INACTIVE', 'LOW_ACTIVE', 'DECLINING')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inactive_member_action_log_actiontype_enum" AS ENUM('ACTION_DM', 'ACTION_ROLE_ADD', 'ACTION_ROLE_REMOVE')`,
    );

    // InactiveMemberConfig
    await queryRunner.query(
      `CREATE TABLE "inactive_member_config" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "periodDays" integer NOT NULL DEFAULT '30',
        "lowActiveThresholdMin" integer NOT NULL DEFAULT '30',
        "decliningPercent" integer NOT NULL DEFAULT '50',
        "autoActionEnabled" boolean NOT NULL DEFAULT false,
        "autoRoleAdd" boolean NOT NULL DEFAULT false,
        "autoDm" boolean NOT NULL DEFAULT false,
        "inactiveRoleId" character varying,
        "removeRoleId" character varying,
        "excludedRoleIds" json NOT NULL DEFAULT '[]',
        "dmEmbedTitle" character varying,
        "dmEmbedBody" text,
        "dmEmbedColor" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inactive_member_config_guild" UNIQUE ("guildId"),
        CONSTRAINT "PK_inactive_member_config" PRIMARY KEY ("id")
      )`,
    );

    // InactiveMemberRecord
    await queryRunner.query(
      `CREATE TABLE "inactive_member_record" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "grade" "public"."inactive_member_record_grade_enum",
        "totalMinutes" integer NOT NULL DEFAULT '0',
        "prevTotalMinutes" integer NOT NULL DEFAULT '0',
        "lastVoiceDate" date,
        "gradeChangedAt" TIMESTAMP,
        "classifiedAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inactive_member_record_guild_user" UNIQUE ("guildId", "userId"),
        CONSTRAINT "PK_inactive_member_record" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inactive_member_record_guild_grade" ON "inactive_member_record" ("guildId", "grade")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inactive_member_record_guild_last_voice" ON "inactive_member_record" ("guildId", "lastVoiceDate")`,
    );

    // InactiveMemberActionLog
    await queryRunner.query(
      `CREATE TABLE "inactive_member_action_log" (
        "id" SERIAL NOT NULL,
        "guildId" character varying NOT NULL,
        "actionType" "public"."inactive_member_action_log_actiontype_enum" NOT NULL,
        "targetUserIds" json NOT NULL,
        "executorUserId" character varying,
        "successCount" integer NOT NULL DEFAULT '0',
        "failCount" integer NOT NULL DEFAULT '0',
        "note" text,
        "executedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inactive_member_action_log" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inactive_action_log_guild_executed" ON "inactive_member_action_log" ("guildId", "executedAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_inactive_action_log_guild_executed"`);
    await queryRunner.query(`DROP TABLE "inactive_member_action_log"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_inactive_member_record_guild_last_voice"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_inactive_member_record_guild_grade"`);
    await queryRunner.query(`DROP TABLE "inactive_member_record"`);
    await queryRunner.query(`DROP TABLE "inactive_member_config"`);
    await queryRunner.query(`DROP TYPE "public"."inactive_member_action_log_actiontype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."inactive_member_record_grade_enum"`);
  }
}
