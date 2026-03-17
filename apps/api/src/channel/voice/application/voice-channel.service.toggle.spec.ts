import { type VoiceStateDto } from '../infrastructure/voice-state.dto';
import { VoiceChannelService } from './voice-channel.service';

function makeDto(): VoiceStateDto {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    channelId: 'ch-1',
    userName: 'Alice',
    channelName: 'General',
    parentCategoryId: null,
    categoryName: null,
    micOn: true,
    alone: false,
    channelMemberCount: 1,
    avatarUrl: null,
    streaming: false,
    videoOn: false,
    selfDeaf: false,
  } as VoiceStateDto;
}

describe('VoiceChannelService — toggle 메서드', () => {
  let service: VoiceChannelService;
  let mockSessionService: { startOrUpdateSession: jest.Mock };

  beforeEach(() => {
    mockSessionService = {
      startOrUpdateSession: jest.fn().mockResolvedValue(undefined),
    };

    service = new VoiceChannelService(
      mockSessionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.clearAllMocks();
  });

  describe('onUserStreamingToggle', () => {
    it('sessionService.startOrUpdateSession을 호출한다', async () => {
      const dto = makeDto();

      await service.onUserStreamingToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledWith(dto);
    });

    it('startOrUpdateSession이 정확히 1번 호출된다', async () => {
      const dto = makeDto();

      await service.onUserStreamingToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUserVideoToggle', () => {
    it('sessionService.startOrUpdateSession을 호출한다', async () => {
      const dto = makeDto();

      await service.onUserVideoToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledWith(dto);
    });

    it('startOrUpdateSession이 정확히 1번 호출된다', async () => {
      const dto = makeDto();

      await service.onUserVideoToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUserDeafToggle', () => {
    it('sessionService.startOrUpdateSession을 호출한다', async () => {
      const dto = makeDto();

      await service.onUserDeafToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledWith(dto);
    });

    it('startOrUpdateSession이 정확히 1번 호출된다', async () => {
      const dto = makeDto();

      await service.onUserDeafToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUserMicToggle (기존 동작 회귀 검증)', () => {
    it('sessionService.startOrUpdateSession을 호출한다', async () => {
      const dto = makeDto();

      await service.onUserMicToggle(dto);

      expect(mockSessionService.startOrUpdateSession).toHaveBeenCalledWith(dto);
    });
  });
});
