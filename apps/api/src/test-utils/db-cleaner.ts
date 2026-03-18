import type { DataSource } from 'typeorm';

/** 모든 테이블을 TRUNCATE하여 테스트 데이터를 정리한다 (마이그레이션 테이블 제외) */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;
  const tableNames = entities.map((e) => `"${e.tableName}"`).join(', ');

  if (tableNames.length > 0) {
    await dataSource.query(`TRUNCATE TABLE ${tableNames} CASCADE`);
  }
}
