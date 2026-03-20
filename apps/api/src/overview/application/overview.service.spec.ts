import type { Repository } from 'typeorm';
import type { Mocked } from 'vitest';

import type { VoiceDailyOrm } from '../../channel/voice/infrastructure/voice-daily.orm-entity';
import type { DiscordRestService } from '../../discord-rest/discord-rest.service';
import type { DiscordGateway } from '../../gateway/discord.gateway';
import type { InactiveMemberRecordOrm } from '../../inactive-member/infrastructure/inactive-member-record.orm-entity';
import type { BotMetricOrm } from '../../monitoring/infrastructure/bot-metric.orm-entity';
import type { NewbieConfigRepository } from '../../newbie/infrastructure/newbie-config.repository';
import type { NewbieMissionRepository } from '../../newbie/infrastructure/newbie-mission.repository';
import { OverviewService } from './overview.service';

function makeQb(rawValue: unknown, oneValue?: unknown) {
  const qb = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue(oneValue ?? rawValue),
    getRawMany: vi.fn().mockResolvedValue(rawValue),
    getOne: vi.fn().mockResolvedValue(oneValue ?? null),
  };
  return qb;
}

describe('OverviewService', () => {
  let service: OverviewService;
  let discordGateway: Mocked<DiscordGateway>;
  let discordRest: Mocked<DiscordRestService>;
  let newbieConfigRepo: Mocked<NewbieConfigRepository>;
  let newbieMissionRepo: Mocked<NewbieMissionRepository>;
  let voiceDailyRepo: Mocked<Repository<VoiceDailyOrm>>;
  let botMetricRepo: Mocked<Repository<BotMetricOrm>>;
  let inactiveRecordRepo: Mocked<Repository<InactiveMemberRecordOrm>>;

  beforeEach(() => {
    discordGateway = {} as unknown as Mocked<DiscordGateway>;

    discordRest = {
      fetchGuild: vi.fn(),
    } as unknown as Mocked<DiscordRestService>;

    newbieConfigRepo = {
      findByGuildId: vi.fn(),
    } as unknown as Mocked<NewbieConfigRepository>;

    newbieMissionRepo = {
      countByStatusForGuild: vi.fn(),
    } as unknown as Mocked<NewbieMissionRepository>;

    voiceDailyRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<VoiceDailyOrm>>;

    botMetricRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<BotMetricOrm>>;

    inactiveRecordRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<InactiveMemberRecordOrm>>;

    service = new OverviewService(
      discordGateway,
      discordRest,
      newbieConfigRepo,
      newbieMissionRepo,
      voiceDailyRepo,
      botMetricRepo,
      inactiveRecordRepo,
    );
  });

  describe('getOverview', () => {
    beforeEach(() => {
      // Discord REST: 1000명
      discordRest.fetchGuild.mockResolvedValue({
        approximate_member_count: 1000,
      } as Awaited<ReturnType<typeof discordRest.fetchGuild>>);

      // 오늘 voice totalSec
      const voiceTodayQb = makeQb({ totalSec: '7200' });
      // 주간 voice
      const voiceWeeklyQb = makeQb([]);

      let voiceQbCallCount = 0;
      voiceDailyRepo.createQueryBuilder.mockImplementation(() => {
        voiceQbCallCount++;
        // 첫 번째 호출: 오늘 totalSec, 두 번째 호출: 주간 데이터
        return (voiceQbCallCount === 1 ? voiceTodayQb : voiceWeeklyQb) as ReturnType<
          typeof voiceDailyRepo.createQueryBuilder
        >;
      });

      // 현재 음성 사용자 수
      const botMetricQb = makeQb(null, { voiceUserCount: 5 });
      botMetricRepo.createQueryBuilder.mockReturnValue(
        botMetricQb as ReturnType<typeof botMetricRepo.createQueryBuilder>,
      );

      // 비활동 통계
      const inactiveQb = makeQb([
        { grade: 'FULLY_INACTIVE', count: '3' },
        { grade: 'LOW_ACTIVE', count: '2' },
        { grade: null, count: '10' },
      ]);
      inactiveRecordRepo.createQueryBuilder.mockReturnValue(
        inactiveQb as ReturnType<typeof inactiveRecordRepo.createQueryBuilder>,
      );

      // 미션 요약: 비활성화
      newbieConfigRepo.findByGuildId.mockResolvedValue(null);
    });

    it('정상적으로 overview 데이터를 반환한다', async () => {
      const result = await service.getOverview('guild-1');

      expect(result.totalMemberCount).toBe(1000);
      expect(result.todayVoiceTotalSec).toBe(7200);
      expect(result.currentVoiceUserCount).toBe(5);
    });

    it('Discord fetchGuild이 null을 반환하면 totalMemberCount는 0이다', async () => {
      discordRest.fetchGuild.mockResolvedValue(null);

      const result = await service.getOverview('guild-1');

      expect(result.totalMemberCount).toBe(0);
    });

    it('missionEnabled가 false이면 missionSummary는 null이다', async () => {
      newbieConfigRepo.findByGuildId.mockResolvedValue({
        missionEnabled: false,
      } as Awaited<ReturnType<typeof newbieConfigRepo.findByGuildId>>);

      const result = await service.getOverview('guild-1');

      expect(result.missionSummary).toBeNull();
    });

    it('missionEnabled가 true이면 missionSummary를 포함한다', async () => {
      newbieConfigRepo.findByGuildId.mockResolvedValue({
        missionEnabled: true,
      } as Awaited<ReturnType<typeof newbieConfigRepo.findByGuildId>>);

      newbieMissionRepo.countByStatusForGuild.mockResolvedValue({
        IN_PROGRESS: 5,
        COMPLETED: 10,
        FAILED: 2,
      } as Awaited<ReturnType<typeof newbieMissionRepo.countByStatusForGuild>>);

      const result = await service.getOverview('guild-1');

      expect(result.missionSummary).toEqual({
        inProgress: 5,
        completed: 10,
        failed: 2,
      });
    });

    it('비활동 통계를 올바르게 집계한다', async () => {
      const result = await service.getOverview('guild-1');

      // FULLY_INACTIVE: 3, LOW_ACTIVE: 2, null(active): 10 → total: 15
      // activeRate = round(10/15 * 100) = 67
      expect(result.inactiveByGrade.fullyInactive).toBe(3);
      expect(result.inactiveByGrade.lowActive).toBe(2);
      expect(result.activeRate).toBe(67);
    });

    it('비활동 레코드가 없으면 activeRate는 0이다', async () => {
      const emptyQb = makeQb([]);
      inactiveRecordRepo.createQueryBuilder.mockReturnValue(
        emptyQb as ReturnType<typeof inactiveRecordRepo.createQueryBuilder>,
      );

      const result = await service.getOverview('guild-1');

      expect(result.activeRate).toBe(0);
    });
  });

  describe('getWeeklyVoice', () => {
    it('7일치 날짜를 반환하고 데이터 없는 날은 0으로 채운다', async () => {
      // 오늘 통계 쿼리
      const todayQb = makeQb({ totalSec: '0' });
      // 주간 데이터: 특정 날짜만 데이터 있음
      const weeklyQb = makeQb([]);

      let callCount = 0;
      voiceDailyRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        return (callCount === 1 ? todayQb : weeklyQb) as ReturnType<
          typeof voiceDailyRepo.createQueryBuilder
        >;
      });

      discordRest.fetchGuild.mockResolvedValue({ approximate_member_count: 0 } as Awaited<
        ReturnType<typeof discordRest.fetchGuild>
      >);
      botMetricRepo.createQueryBuilder.mockReturnValue(
        makeQb(null, null) as ReturnType<typeof botMetricRepo.createQueryBuilder>,
      );
      inactiveRecordRepo.createQueryBuilder.mockReturnValue(
        makeQb([]) as ReturnType<typeof inactiveRecordRepo.createQueryBuilder>,
      );
      newbieConfigRepo.findByGuildId.mockResolvedValue(null);

      const result = await service.getOverview('guild-1');

      expect(result.weeklyVoice).toHaveLength(7);
      result.weeklyVoice.forEach((entry) => {
        expect(entry.date).toMatch(/^\d{8}$/); // YYYYMMDD 형식
        expect(entry.totalSec).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
