import { type Mock } from 'vitest';

import { type StickyMessageSaveDto } from '../dto/sticky-message-save.dto';
import { type StickyMessageConfigOrm } from '../infrastructure/sticky-message-config.orm-entity';
import { StickyMessageConfigService } from './sticky-message-config.service';

function makeConfigOrm(overrides: Partial<StickyMessageConfigOrm> = {}): StickyMessageConfigOrm {
  return {
    id: 1,
    guildId: 'guild-1',
    channelId: 'ch-1',
    enabled: true,
    embedTitle: '공지',
    embedDescription: '내용',
    embedColor: '#5865F2',
    messageId: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSaveDto(overrides: Partial<StickyMessageSaveDto> = {}): StickyMessageSaveDto {
  return {
    channelId: 'ch-1',
    enabled: true,
    embedTitle: '공지',
    embedDescription: '내용',
    embedColor: '#5865F2',
    sortOrder: 0,
    ...overrides,
  };
}

describe('StickyMessageConfigService', () => {
  let service: StickyMessageConfigService;
  let configRepo: {
    findByGuildId: Mock;
    save: Mock;
    findById: Mock;
    delete: Mock;
    deleteByGuildAndChannel: Mock;
    updateMessageId: Mock;
  };
  let redisRepo: { getConfig: Mock; setConfig: Mock; deleteConfig: Mock };
  let discordAdapter: { sendMessage: Mock; deleteMessage: Mock };

  beforeEach(() => {
    configRepo = {
      findByGuildId: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByGuildAndChannel: vi.fn().mockResolvedValue(undefined),
      updateMessageId: vi.fn().mockResolvedValue(undefined),
    };

    redisRepo = {
      getConfig: vi.fn(),
      setConfig: vi.fn().mockResolvedValue(undefined),
      deleteConfig: vi.fn().mockResolvedValue(undefined),
    };

    discordAdapter = {
      sendMessage: vi.fn(),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    };

    service = new StickyMessageConfigService(
      configRepo as never,
      redisRepo as never,
      discordAdapter as never,
    );

    vi.clearAllMocks();
  });

  describe('getConfigs', () => {
    it('캐시 히트: Redis에 설정이 있으면 DB를 조회하지 않고 반환', async () => {
      const cached = [makeConfigOrm()];
      redisRepo.getConfig.mockResolvedValue(cached);

      const result = await service.getConfigs('guild-1');

      expect(result).toBe(cached);
      expect(configRepo.findByGuildId).not.toHaveBeenCalled();
    });

    it('캐시 미스: DB 조회 후 캐시에 저장하고 반환', async () => {
      redisRepo.getConfig.mockResolvedValue(null);
      const dbConfigs = [makeConfigOrm()];
      configRepo.findByGuildId.mockResolvedValue(dbConfigs);

      const result = await service.getConfigs('guild-1');

      expect(configRepo.findByGuildId).toHaveBeenCalledWith('guild-1');
      expect(redisRepo.setConfig).toHaveBeenCalledWith('guild-1', dbConfigs);
      expect(result).toBe(dbConfigs);
    });

    it('DB 결과가 빈 목록이면 캐시에 저장하지 않음', async () => {
      redisRepo.getConfig.mockResolvedValue(null);
      configRepo.findByGuildId.mockResolvedValue([]);

      const result = await service.getConfigs('guild-1');

      expect(redisRepo.setConfig).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('saveConfig', () => {
    it('DB 저장 후 캐시 갱신', async () => {
      const saved = makeConfigOrm({ enabled: false });
      configRepo.save.mockResolvedValue(saved);
      configRepo.findByGuildId.mockResolvedValue([saved]);

      await service.saveConfig('guild-1', makeSaveDto({ enabled: false }));

      expect(configRepo.save).toHaveBeenCalled();
      expect(redisRepo.setConfig).toHaveBeenCalledWith('guild-1', [saved]);
    });

    it('enabled=true이면 Discord 메시지 전송 및 messageId 갱신', async () => {
      const saved = makeConfigOrm({ enabled: true, messageId: null });
      configRepo.save.mockResolvedValue(saved);
      configRepo.findByGuildId.mockResolvedValue([saved]);
      discordAdapter.sendMessage.mockResolvedValue('msg-100');

      const result = await service.saveConfig('guild-1', makeSaveDto({ enabled: true }));

      expect(discordAdapter.sendMessage).toHaveBeenCalledWith('ch-1', expect.anything());
      expect(configRepo.updateMessageId).toHaveBeenCalledWith(1, 'msg-100');
      expect(result.messageId).toBe('msg-100');
    });

    it('기존 messageId 있으면 먼저 삭제 후 신규 메시지 전송', async () => {
      const saved = makeConfigOrm({ enabled: true, messageId: 'old-msg' });
      configRepo.save.mockResolvedValue(saved);
      configRepo.findByGuildId.mockResolvedValue([saved]);
      discordAdapter.sendMessage.mockResolvedValue('new-msg');

      await service.saveConfig('guild-1', makeSaveDto({ enabled: true }));

      // 기존 메시지 삭제 먼저
      expect(discordAdapter.deleteMessage).toHaveBeenCalledWith('ch-1', 'old-msg');
      // 새 메시지 전송
      expect(discordAdapter.sendMessage).toHaveBeenCalled();
    });

    it('enabled=false이면 Discord 메시지 전송하지 않음', async () => {
      const saved = makeConfigOrm({ enabled: false });
      configRepo.save.mockResolvedValue(saved);
      configRepo.findByGuildId.mockResolvedValue([saved]);

      await service.saveConfig('guild-1', makeSaveDto({ enabled: false }));

      expect(discordAdapter.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('deleteConfig', () => {
    it('messageId 있으면 Discord 메시지 삭제 → DB 삭제 → 캐시 무효화', async () => {
      const config = makeConfigOrm({ messageId: 'msg-1' });
      configRepo.findById.mockResolvedValue(config);

      await service.deleteConfig('guild-1', 1);

      expect(discordAdapter.deleteMessage).toHaveBeenCalledWith('ch-1', 'msg-1');
      expect(configRepo.delete).toHaveBeenCalledWith(1);
      expect(redisRepo.deleteConfig).toHaveBeenCalledWith('guild-1');
    });

    it('messageId 없으면 Discord 삭제 시도 없이 DB 삭제', async () => {
      const config = makeConfigOrm({ messageId: null });
      configRepo.findById.mockResolvedValue(config);

      await service.deleteConfig('guild-1', 1);

      expect(discordAdapter.deleteMessage).not.toHaveBeenCalled();
      expect(configRepo.delete).toHaveBeenCalledWith(1);
    });

    it('설정 조회 결과가 null이면 DB 삭제와 캐시 무효화만 수행', async () => {
      configRepo.findById.mockResolvedValue(null);

      await service.deleteConfig('guild-1', 1);

      expect(discordAdapter.deleteMessage).not.toHaveBeenCalled();
      expect(configRepo.delete).toHaveBeenCalledWith(1);
      expect(redisRepo.deleteConfig).toHaveBeenCalledWith('guild-1');
    });
  });

  describe('deleteByChannel', () => {
    it('채널 내 전체 설정 삭제: Discord 메시지 삭제 → DB 삭제 → 캐시 무효화', async () => {
      const configs = [
        makeConfigOrm({ id: 1, channelId: 'ch-1', messageId: 'msg-1' }),
        makeConfigOrm({ id: 2, channelId: 'ch-1', messageId: null }),
      ];
      configRepo.findByGuildId.mockResolvedValue(configs);

      const result = await service.deleteByChannel('guild-1', 'ch-1');

      // messageId 있는 것만 Discord 삭제
      expect(discordAdapter.deleteMessage).toHaveBeenCalledTimes(1);
      expect(discordAdapter.deleteMessage).toHaveBeenCalledWith('ch-1', 'msg-1');
      expect(configRepo.deleteByGuildAndChannel).toHaveBeenCalledWith('guild-1', 'ch-1');
      expect(redisRepo.deleteConfig).toHaveBeenCalledWith('guild-1');
      expect(result.deletedCount).toBe(2);
    });

    it('채널에 설정이 없으면 deletedCount: 0 반환', async () => {
      configRepo.findByGuildId.mockResolvedValue([]);

      const result = await service.deleteByChannel('guild-1', 'ch-empty');

      expect(discordAdapter.deleteMessage).not.toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
    });

    it('다른 채널의 설정은 삭제하지 않음', async () => {
      const configs = [
        makeConfigOrm({ id: 1, channelId: 'ch-1', messageId: 'msg-1' }),
        makeConfigOrm({ id: 2, channelId: 'ch-2', messageId: 'msg-2' }),
      ];
      configRepo.findByGuildId.mockResolvedValue(configs);

      const result = await service.deleteByChannel('guild-1', 'ch-1');

      // ch-1 설정만 Discord 삭제
      expect(discordAdapter.deleteMessage).toHaveBeenCalledTimes(1);
      expect(discordAdapter.deleteMessage).toHaveBeenCalledWith('ch-1', 'msg-1');
      expect(result.deletedCount).toBe(1);
    });
  });
});
