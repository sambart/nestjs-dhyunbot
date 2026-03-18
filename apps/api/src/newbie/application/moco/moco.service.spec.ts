import { type Mocked, vi } from 'vitest';

import { type NewbieConfigOrmEntity as NewbieConfig } from '../../infrastructure/newbie-config.orm-entity';
import { type NewbieConfigRepository } from '../../infrastructure/newbie-config.repository';
import { type NewbieRedisRepository } from '../../infrastructure/newbie-redis.repository';
import { MocoService } from './moco.service';
import { type MocoDiscordPresenter } from './moco-discord.presenter';

function makeConfig(overrides: Partial<NewbieConfig> = {}): NewbieConfig {
  return {
    id: 1,
    guildId: 'guild-1',
    mocoEnabled: true,
    mocoRankChannelId: 'ch-rank',
    mocoRankMessageId: 'msg-1',
    ...overrides,
  } as NewbieConfig;
}

describe('MocoService', () => {
  let service: MocoService;
  let configRepo: Mocked<NewbieConfigRepository>;
  let newbieRedis: Mocked<NewbieRedisRepository>;
  let presenter: Mocked<MocoDiscordPresenter>;

  beforeEach(() => {
    configRepo = {
      findByGuildId: vi.fn().mockResolvedValue(makeConfig()),
    } as unknown as Mocked<NewbieConfigRepository>;

    newbieRedis = {
      getMocoRankCount: vi.fn().mockResolvedValue(0),
      getMocoRankPage: vi.fn().mockResolvedValue([]),
      getMocoHunterScore: vi.fn().mockResolvedValue(null),
      getMocoHunterRank: vi.fn().mockResolvedValue(null),
      getMocoHunterDetail: vi.fn().mockResolvedValue({}),
      getMocoHunterMeta: vi.fn().mockResolvedValue(null),
      getMocoNewbieSessions: vi.fn().mockResolvedValue({}),
    } as unknown as Mocked<NewbieRedisRepository>;

    presenter = {
      buildRankPayload: vi.fn().mockResolvedValue({ embeds: [], components: [] }),
      deleteEmbed: vi.fn().mockResolvedValue(undefined),
      sendOrUpdateRankEmbed: vi.fn().mockResolvedValue(undefined),
      fetchDisplayNames: vi.fn().mockResolvedValue({}),
    } as unknown as Mocked<MocoDiscordPresenter>;

    service = new MocoService(configRepo, newbieRedis, presenter);
  });

  describe('buildRankPayload', () => {
    it('config와 rank 데이터로 payload를 구성한다', async () => {
      newbieRedis.getMocoRankCount.mockResolvedValue(0);
      newbieRedis.getMocoRankPage.mockResolvedValue([]);

      await service.buildRankPayload('guild-1', 1);

      expect(configRepo.findByGuildId).toHaveBeenCalledWith('guild-1');
      expect(presenter.buildRankPayload).toHaveBeenCalled();
    });
  });

  describe('deleteEmbed', () => {
    it('presenter의 deleteEmbed를 호출한다', async () => {
      await service.deleteEmbed('ch-1', 'msg-1');

      expect(presenter.deleteEmbed).toHaveBeenCalledWith('ch-1', 'msg-1');
    });
  });

  describe('sendOrUpdateRankEmbed', () => {
    it('mocoRankChannelId가 설정되어 있으면 Embed를 전송/수정한다', async () => {
      newbieRedis.getMocoRankCount.mockResolvedValue(0);
      newbieRedis.getMocoRankPage.mockResolvedValue([]);

      await service.sendOrUpdateRankEmbed('guild-1', 1);

      expect(presenter.sendOrUpdateRankEmbed).toHaveBeenCalled();
    });

    it('mocoRankChannelId가 없으면 아무것도 하지 않는다', async () => {
      configRepo.findByGuildId.mockResolvedValue(makeConfig({ mocoRankChannelId: null }));

      await service.sendOrUpdateRankEmbed('guild-1', 1);

      expect(presenter.sendOrUpdateRankEmbed).not.toHaveBeenCalled();
    });

    it('config가 null이면 아무것도 하지 않는다', async () => {
      configRepo.findByGuildId.mockResolvedValue(null as never);

      await service.sendOrUpdateRankEmbed('guild-1', 1);

      expect(presenter.sendOrUpdateRankEmbed).not.toHaveBeenCalled();
    });
  });

  describe('buildMyHuntingMessage', () => {
    it('사냥 기록이 없으면 안내 메시지를 반환한다', async () => {
      newbieRedis.getMocoHunterScore.mockResolvedValue(null);
      newbieRedis.getMocoHunterRank.mockResolvedValue(null);

      const result = await service.buildMyHuntingMessage('guild-1', 'user-1');

      expect(result).toBe('아직 모코코 사냥 기록이 없습니다.');
    });

    it('사냥 기록이 있으면 통계 메시지를 반환한다', async () => {
      newbieRedis.getMocoHunterScore.mockResolvedValue(150);
      newbieRedis.getMocoHunterRank.mockResolvedValue(3);
      newbieRedis.getMocoRankCount.mockResolvedValue(10);
      newbieRedis.getMocoHunterMeta.mockResolvedValue({
        score: 200,
        sessionCount: 5,
        uniqueNewbieCount: 3,
        totalMinutes: 150,
      });
      newbieRedis.getMocoHunterDetail.mockResolvedValue({});
      newbieRedis.getMocoNewbieSessions.mockResolvedValue({});

      const result = await service.buildMyHuntingMessage('guild-1', 'user-1');

      expect(result).toContain('3위');
      expect(result).toContain('10명');
      expect(result).toContain('200점');
      expect(result).toContain('150분');
      expect(result).toContain('5회');
      expect(result).toContain('3명');
    });

    it('도움 받은 모코코 목록을 포함한다', async () => {
      newbieRedis.getMocoHunterScore.mockResolvedValue(100);
      newbieRedis.getMocoHunterRank.mockResolvedValue(1);
      newbieRedis.getMocoRankCount.mockResolvedValue(5);
      newbieRedis.getMocoHunterMeta.mockResolvedValue(null);
      newbieRedis.getMocoHunterDetail.mockResolvedValue({
        'newbie-1': 60,
        'newbie-2': 30,
      });
      newbieRedis.getMocoNewbieSessions.mockResolvedValue({
        'newbie-1': 3,
        'newbie-2': 1,
      });
      presenter.fetchDisplayNames.mockResolvedValue({
        'newbie-1': '모코코A',
        'newbie-2': '모코코B',
      });

      const result = await service.buildMyHuntingMessage('guild-1', 'user-1');

      expect(result).toContain('모코코A');
      expect(result).toContain('60분');
      expect(result).toContain('3회');
      expect(result).toContain('모코코B');
    });
  });

  describe('getHunterDetail', () => {
    it('사냥꾼의 모코코 상세 목록을 반환한다', async () => {
      newbieRedis.getMocoHunterDetail.mockResolvedValue({
        'n-1': 60,
        'n-2': 30,
      });
      newbieRedis.getMocoNewbieSessions.mockResolvedValue({
        'n-1': 3,
        'n-2': 1,
      });
      presenter.fetchDisplayNames.mockResolvedValue({
        'n-1': 'Newbie1',
        'n-2': 'Newbie2',
      });

      const result = await service.getHunterDetail('guild-1', 'hunter-1');

      expect(result).toEqual([
        { newbieId: 'n-1', newbieName: 'Newbie1', minutes: 60, sessions: 3 },
        { newbieId: 'n-2', newbieName: 'Newbie2', minutes: 30, sessions: 1 },
      ]);
    });

    it('상세 정보가 없으면 빈 배열을 반환한다', async () => {
      newbieRedis.getMocoHunterDetail.mockResolvedValue({});

      const result = await service.getHunterDetail('guild-1', 'hunter-1');

      expect(result).toEqual([]);
    });

    it('minutes 기준으로 내림차순 정렬한다', async () => {
      newbieRedis.getMocoHunterDetail.mockResolvedValue({
        'n-1': 10,
        'n-2': 50,
        'n-3': 30,
      });
      newbieRedis.getMocoNewbieSessions.mockResolvedValue({});
      presenter.fetchDisplayNames.mockResolvedValue({});

      const result = await service.getHunterDetail('guild-1', 'hunter-1');

      expect(result[0]!.minutes).toBe(50);
      expect(result[1]!.minutes).toBe(30);
      expect(result[2]!.minutes).toBe(10);
    });
  });
});
