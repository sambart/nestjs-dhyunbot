import type { Mocked } from 'vitest';

import type { DiscordVoiceGateway } from '../infrastructure/discord-voice.gateway';
import type { TempChannelStore } from '../infrastructure/temp-channel-store';
import { VoiceStateDto } from '../infrastructure/voice-state.dto';
import type { VoiceChannelPolicy } from './voice-channel.policy';
import { VoiceTempChannelService } from './voice-temp-channel.service';

function makeVoiceStateDto(overrides: Partial<VoiceStateDto> = {}): VoiceStateDto {
  return new VoiceStateDto(
    overrides.guildId ?? 'guild-1',
    overrides.userId ?? 'user-1',
    overrides.channelId ?? 'ch-create',
    overrides.userName ?? 'Alice',
    overrides.channelName ?? 'Create',
    // null을 명시적으로 전달할 수 있도록 ?? 대신 undefined 체크 사용
    overrides.parentCategoryId !== undefined ? overrides.parentCategoryId : 'cat-1',
    overrides.categoryName !== undefined ? overrides.categoryName : 'Category',
    overrides.micOn ?? true,
    overrides.alone ?? false,
    overrides.channelMemberCount ?? 1,
    overrides.avatarUrl !== undefined ? overrides.avatarUrl : null,
    overrides.streaming ?? false,
    overrides.videoOn ?? false,
    overrides.selfDeaf ?? false,
  );
}

describe('VoiceTempChannelService', () => {
  let service: VoiceTempChannelService;
  let tempChannelStore: Mocked<TempChannelStore>;
  let policy: Mocked<VoiceChannelPolicy>;
  let discord: Mocked<DiscordVoiceGateway>;

  beforeEach(() => {
    tempChannelStore = {
      registerTempChannel: vi.fn().mockResolvedValue(undefined),
      unregisterTempChannel: vi.fn().mockResolvedValue(undefined),
      isTempChannel: vi.fn().mockResolvedValue(false),
      addMember: vi.fn().mockResolvedValue(undefined),
      removeMember: vi.fn().mockResolvedValue(undefined),
      isEmpty: vi.fn().mockResolvedValue(false),
    } as Mocked<TempChannelStore>;

    policy = {
      shouldCreateTempChannel: vi.fn().mockReturnValue(false),
      shouldDeleteChannel: vi.fn().mockResolvedValue(false),
    } as unknown as Mocked<VoiceChannelPolicy>;

    discord = {
      createVoiceChannel: vi.fn().mockResolvedValue('temp-ch-1'),
      moveUserToChannel: vi.fn().mockResolvedValue(undefined),
      deleteChannel: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<DiscordVoiceGateway>;

    service = new VoiceTempChannelService(tempChannelStore, policy, discord);
  });

  describe('handleJoin', () => {
    it('정책이 true일 때 임시 채널을 생성하고 사용자를 이동시킨다', async () => {
      policy.shouldCreateTempChannel.mockReturnValue(true);
      discord.createVoiceChannel.mockResolvedValue('temp-ch-new');

      const cmd = makeVoiceStateDto({ channelId: 'ch-create', parentCategoryId: 'cat-1' });

      await service.handleJoin(cmd);

      expect(discord.createVoiceChannel).toHaveBeenCalledWith({
        guildId: 'guild-1',
        name: '임시',
        parentCategoryId: 'cat-1',
      });
      expect(tempChannelStore.registerTempChannel).toHaveBeenCalledWith('guild-1', 'temp-ch-new');
      expect(tempChannelStore.addMember).toHaveBeenCalledWith('temp-ch-new', 'user-1');
      expect(discord.moveUserToChannel).toHaveBeenCalledWith('guild-1', 'user-1', 'temp-ch-new');
    });

    it('정책이 false이면 임시 채널을 생성하지 않는다', async () => {
      policy.shouldCreateTempChannel.mockReturnValue(false);

      const cmd = makeVoiceStateDto({ channelId: 'ch-normal' });

      await service.handleJoin(cmd);

      expect(discord.createVoiceChannel).not.toHaveBeenCalled();
      expect(tempChannelStore.registerTempChannel).not.toHaveBeenCalled();
    });

    it('parentCategoryId가 null이면 parentCategoryId를 undefined로 전달한다', async () => {
      policy.shouldCreateTempChannel.mockReturnValue(true);
      discord.createVoiceChannel.mockResolvedValue('temp-ch-no-cat');

      const cmd = makeVoiceStateDto({ parentCategoryId: null });

      await service.handleJoin(cmd);

      expect(discord.createVoiceChannel).toHaveBeenCalledWith({
        guildId: 'guild-1',
        name: '임시',
        parentCategoryId: undefined,
      });
    });
  });

  describe('handleLeave', () => {
    it('정책이 true이면 멤버를 제거하고 채널을 삭제한다', async () => {
      policy.shouldDeleteChannel.mockResolvedValue(true);

      const cmd = makeVoiceStateDto({ channelId: 'temp-ch-1' });

      await service.handleLeave(cmd);

      expect(tempChannelStore.removeMember).toHaveBeenCalledWith('temp-ch-1', 'user-1');
      expect(tempChannelStore.unregisterTempChannel).toHaveBeenCalledWith('guild-1', 'temp-ch-1');
      expect(discord.deleteChannel).toHaveBeenCalledWith('temp-ch-1');
    });

    it('정책이 false이면 채널을 삭제하지 않는다', async () => {
      policy.shouldDeleteChannel.mockResolvedValue(false);

      const cmd = makeVoiceStateDto({ channelId: 'temp-ch-1' });

      await service.handleLeave(cmd);

      expect(discord.deleteChannel).not.toHaveBeenCalled();
      expect(tempChannelStore.removeMember).not.toHaveBeenCalled();
    });

    it('channelId가 falsy이면 아무 작업도 하지 않는다', async () => {
      // channelId가 빈 문자열인 경우
      const cmd = makeVoiceStateDto({ channelId: '' });

      await service.handleLeave(cmd);

      expect(policy.shouldDeleteChannel).not.toHaveBeenCalled();
      expect(discord.deleteChannel).not.toHaveBeenCalled();
    });
  });
});
