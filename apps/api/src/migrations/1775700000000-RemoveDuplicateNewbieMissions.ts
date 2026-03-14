import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class RemoveDuplicateNewbieMissions1775700000000 implements MigrationInterface {
  name = 'RemoveDuplicateNewbieMissions1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 같은 guildId+memberId에 여러 미션이 존재하는 경우, 가장 작은 id만 남기고 삭제
    await queryRunner.query(`
      DELETE FROM "newbie_mission"
      WHERE "id" NOT IN (
        SELECT MIN("id") FROM "newbie_mission"
        GROUP BY "guildId", "memberId"
      )
    `);
  }

  public async down(): Promise<void> {
    // 삭제된 중복 데이터는 복원할 수 없다
  }
}
