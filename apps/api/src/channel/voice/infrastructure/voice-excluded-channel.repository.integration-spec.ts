import type { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { createIntegrationModuleBuilder } from '../../../test-utils/create-integration-module';
import { cleanDatabase } from '../../../test-utils/db-cleaner';
import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.types';
import { VoiceExcludedChannelOrm } from './voice-excluded-channel.orm-entity';
import { VoiceExcludedChannelRepository } from './voice-excluded-channel.repository';

describe('VoiceExcludedChannelRepository (Integration)', () => {
  let module: TestingModule;
  let repository: VoiceExcludedChannelRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await createIntegrationModuleBuilder({
      entities: [VoiceExcludedChannelOrm],
      providers: [VoiceExcludedChannelRepository],
      withRedis: false,
    }).compile();

    repository = module.get(VoiceExcludedChannelRepository);
    dataSource = module.get(DataSource);
  }, 60_000);

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('create / findByGuildId', () => {
    it('제외 채널을 생성하고 조회한다', async () => {
      await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);
      await repository.create('guild-1', 'ch-2', VoiceExcludedChannelType.CATEGORY);

      const results = await repository.findByGuildId('guild-1');
      expect(results).toHaveLength(2);
    });

    it('UNIQUE constraint 위반 시 에러를 발생시킨다', async () => {
      await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);

      await expect(
        repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL),
      ).rejects.toThrow();
    });

    it('다른 길드의 채널은 조회되지 않는다', async () => {
      await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);
      await repository.create('guild-2', 'ch-2', VoiceExcludedChannelType.CHANNEL);

      const results = await repository.findByGuildId('guild-1');
      expect(results).toHaveLength(1);
    });
  });

  describe('sync', () => {
    it('기존 채널을 삭제하고 새 목록으로 교체한다', async () => {
      await repository.create('guild-1', 'ch-old-1', VoiceExcludedChannelType.CHANNEL);
      await repository.create('guild-1', 'ch-old-2', VoiceExcludedChannelType.CHANNEL);

      const synced = await repository.sync('guild-1', [
        { discordChannelId: 'ch-new-1', type: VoiceExcludedChannelType.CHANNEL },
        { discordChannelId: 'ch-new-2', type: VoiceExcludedChannelType.CATEGORY },
      ]);

      expect(synced).toHaveLength(2);
      const allRecords = await repository.findByGuildId('guild-1');
      expect(allRecords).toHaveLength(2);
      expect(allRecords.map((r) => r.discordChannelId).sort()).toEqual(['ch-new-1', 'ch-new-2']);
    });

    it('빈 배열로 sync하면 모든 채널이 삭제된다', async () => {
      await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);

      const synced = await repository.sync('guild-1', []);

      expect(synced).toHaveLength(0);
      const remaining = await repository.findByGuildId('guild-1');
      expect(remaining).toHaveLength(0);
    });

    it('다른 길드의 데이터는 영향받지 않는다', async () => {
      await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);
      await repository.create('guild-2', 'ch-2', VoiceExcludedChannelType.CHANNEL);

      await repository.sync('guild-1', []);

      const guild2Records = await repository.findByGuildId('guild-2');
      expect(guild2Records).toHaveLength(1);
    });
  });

  describe('findByIdAndGuildId / delete', () => {
    it('ID와 길드로 조회하고 삭제한다', async () => {
      const created = await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);

      const found = await repository.findByIdAndGuildId(created.id, 'guild-1');
      expect(found).not.toBeNull();

      await repository.delete(created.id);
      const deleted = await repository.findByIdAndGuildId(created.id, 'guild-1');
      expect(deleted).toBeNull();
    });

    it('다른 길드의 ID로 조회하면 null을 반환한다', async () => {
      const created = await repository.create('guild-1', 'ch-1', VoiceExcludedChannelType.CHANNEL);

      const found = await repository.findByIdAndGuildId(created.id, 'guild-other');
      expect(found).toBeNull();
    });
  });
});
