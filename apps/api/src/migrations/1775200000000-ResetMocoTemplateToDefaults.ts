import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ResetMocoTemplateToDefaults1775200000000 implements MigrationInterface {
  name = 'ResetMocoTemplateToDefaults1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 모코코 템플릿을 NULL로 리셋하여 개선된 기본 템플릿이 적용되도록 함
    await queryRunner.query(
      `UPDATE "newbie_moco_template" SET "titleTemplate" = NULL, "bodyTemplate" = NULL, "itemTemplate" = NULL, "footerTemplate" = NULL, "scoringTemplate" = NULL, "updatedAt" = now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 이전 기본값으로 복원
    await queryRunner.query(
      `UPDATE "newbie_moco_template" SET "titleTemplate" = '모코코 사냥 TOP {rank} — {hunterName} 🌱', "bodyTemplate" = '🏆 총 점수: {score}점' || E'\\n' || '⏱️ 사냥 시간: {totalMinutes}분 | 🎮 게임 횟수: {sessionCount}회 | 🌱 모코코: {uniqueNewbieCount}명', "itemTemplate" = '– {newbieName} 🌱: {minutes}분 ({sessions}회)', "scoringTemplate" = '── 점수 산정 ──' || E'\\n' || '🎮 게임 1회: {scorePerSession}점 | ⏱️ 1분당: {scorePerMinute}점 | 🌱 신입 1명당: {scorePerUnique}점' || E'\\n' || '⏳ 최소 {minCoPresence}분 이상 함께해야 1회로 인정', "updatedAt" = now()`,
    );
  }
}
