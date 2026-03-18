import type { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { createIntegrationModuleBuilder } from '../../../test-utils/create-integration-module';
import { cleanDatabase } from '../../../test-utils/db-cleaner';
import { VoiceDailyOrm } from './voice-daily.orm-entity';
import { VoiceDailyRepository } from './voice-daily.repository';

describe('VoiceDailyRepository (Integration)', () => {
  let module: TestingModule;
  let repository: VoiceDailyRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await createIntegrationModuleBuilder({
      entities: [VoiceDailyOrm],
      providers: [VoiceDailyRepository],
      withRedis: false,
    }).compile();

    repository = module.get(VoiceDailyRepository);
    dataSource = module.get(DataSource);
  }, 60_000);

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('accumulateChannelDuration', () => {
    it('신규 레코드를 INSERT한다', async () => {
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        300,
        null,
        null,
      );

      const result = await dataSource.getRepository(VoiceDailyOrm).findOneBy({
        guildId: 'guild-1',
        userId: 'user-1',
        date: '20260318',
        channelId: 'ch-1',
      });
      expect(result).not.toBeNull();
      expect(result!.channelDurationSec).toBe(300);
      expect(result!.userName).toBe('Alice');
      expect(result!.channelName).toBe('General');
    });

    it('기존 레코드에 duration을 누적한다', async () => {
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        300,
        null,
        null,
      );
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        200,
        null,
        null,
      );

      const result = await dataSource.getRepository(VoiceDailyOrm).findOneBy({
        guildId: 'guild-1',
        userId: 'user-1',
        date: '20260318',
        channelId: 'ch-1',
      });
      expect(result!.channelDurationSec).toBe(500);
    });

    it('다른 채널은 별도 레코드로 저장한다', async () => {
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        300,
        null,
        null,
      );
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-2',
        'Gaming',
        150,
        'cat-1',
        'Voice',
      );

      const records = await dataSource.getRepository(VoiceDailyOrm).findBy({
        guildId: 'guild-1',
        userId: 'user-1',
        date: '20260318',
      });
      expect(records).toHaveLength(2);
    });
  });

  describe('accumulateMicDuration', () => {
    it('GLOBAL 채널에 마이크 시간을 누적한다', async () => {
      await repository.accumulateMicDuration('guild-1', 'user-1', '20260318', 100, 50);
      await repository.accumulateMicDuration('guild-1', 'user-1', '20260318', 200, 30);

      const result = await dataSource.getRepository(VoiceDailyOrm).findOneBy({
        guildId: 'guild-1',
        userId: 'user-1',
        date: '20260318',
        channelId: 'GLOBAL',
      });
      expect(result!.micOnSec).toBe(300);
      expect(result!.micOffSec).toBe(80);
    });
  });

  describe('findByGuildIdAndDateRange', () => {
    it('날짜 범위로 레코드를 조회한다', async () => {
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260317',
        'ch-1',
        'General',
        100,
        null,
        null,
      );
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        200,
        null,
        null,
      );
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260319',
        'ch-1',
        'General',
        300,
        null,
        null,
      );

      const results = await repository.findByGuildIdAndDateRange('guild-1', '20260317', '20260318');

      expect(results).toHaveLength(2);
    });

    it('userId를 지정하면 해당 유저만 조회한다', async () => {
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-1',
        'Alice',
        '20260318',
        'ch-1',
        'General',
        100,
        null,
        null,
      );
      await repository.accumulateChannelDuration(
        'guild-1',
        'user-2',
        'Bob',
        '20260318',
        'ch-1',
        'General',
        200,
        null,
        null,
      );

      const results = await repository.findByGuildIdAndDateRange(
        'guild-1',
        '20260318',
        '20260318',
        'user-1',
      );

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-1');
    });
  });
});
