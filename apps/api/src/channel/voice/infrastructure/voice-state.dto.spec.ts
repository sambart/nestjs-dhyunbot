import { type VoiceState } from 'discord.js';

import { InvalidVoiceStateError, VoiceStateDto } from './voice-state.dto';

/**
 * Discord.js Collection.filter()는 Map과 달리 배열이 아닌 Collection을 반환한다.
 * 테스트에서는 filter() 결과의 .size를 사용하므로, size 프로퍼티를 가진 객체를 반환하도록 한다.
 */
function makeDiscordCollection(entries: [string, { user: { bot: boolean } }][]) {
  const map = new Map(entries);
  return {
    filter: (fn: (m: { user: { bot: boolean } }) => boolean) => {
      const filtered = [...map.values()].filter(fn);
      return { size: filtered.length };
    },
    size: map.size,
  };
}

/** VoiceState mock 생성 헬퍼 */
function makeVoiceState(
  overrides: Partial<{
    guildId: string;
    memberId: string;
    displayName: string;
    channelId: string;
    channelName: string;
    parentId: string | null;
    parentName: string | null;
    selfMute: boolean;
    streaming: boolean | undefined;
    selfVideo: boolean;
    selfDeaf: boolean;
    memberCount: number;
    displayAvatarURL: string;
    guild: object | null;
    member: object | null;
    channel: object | null;
  }> = {},
): VoiceState {
  const {
    guildId = 'guild-1',
    memberId = 'user-1',
    displayName = 'TestUser',
    channelId = 'channel-1',
    channelName = 'General',
    parentId = null,
    parentName = null,
    selfMute = false,
    streaming = false,
    selfVideo = false,
    selfDeaf = false,
    memberCount = 1,
    displayAvatarURL = 'https://example.com/avatar.png',
  } = overrides;

  const entries: [string, { user: { bot: boolean } }][] = [];
  for (let i = 0; i < memberCount; i++) {
    entries.push([i === 0 ? memberId : `user-${i}`, { user: { bot: false } }]);
  }

  const guild = overrides.guild !== undefined ? overrides.guild : { id: guildId };
  const member =
    overrides.member !== undefined
      ? overrides.member
      : {
          id: memberId,
          displayName,
          displayAvatarURL: () => displayAvatarURL,
        };
  const channel =
    overrides.channel !== undefined
      ? overrides.channel
      : {
          name: channelName,
          parentId,
          parent: parentName ? { name: parentName } : null,
          members: makeDiscordCollection(entries),
        };

  return {
    guild,
    member,
    channelId,
    channel,
    selfMute,
    streaming,
    selfVideo,
    selfDeaf,
  } as unknown as VoiceState;
}

describe('VoiceStateDto', () => {
  describe('fromVoiceState', () => {
    it('정상 상태에서 올바른 DTO를 생성한다', () => {
      const state = makeVoiceState({
        guildId: 'guild-1',
        memberId: 'user-1',
        displayName: 'Alice',
        channelId: 'ch-1',
        channelName: 'General',
        selfMute: false,
        streaming: false,
        selfVideo: false,
        selfDeaf: false,
      });

      const dto = VoiceStateDto.fromVoiceState(state);

      expect(dto.guildId).toBe('guild-1');
      expect(dto.userId).toBe('user-1');
      expect(dto.channelId).toBe('ch-1');
      expect(dto.channelName).toBe('General');
    });

    it('selfMute=false이면 micOn=true가 된다', () => {
      const state = makeVoiceState({ selfMute: false });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.micOn).toBe(true);
    });

    it('selfMute=true이면 micOn=false가 된다', () => {
      const state = makeVoiceState({ selfMute: true });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.micOn).toBe(false);
    });

    it('streaming=true이면 dto.streaming=true다', () => {
      const state = makeVoiceState({ streaming: true });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.streaming).toBe(true);
    });

    it('streaming=false이면 dto.streaming=false다', () => {
      const state = makeVoiceState({ streaming: false });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.streaming).toBe(false);
    });

    it('streaming=undefined이면 dto.streaming=false다 (null 안전 처리)', () => {
      const state = makeVoiceState({ streaming: undefined });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.streaming).toBe(false);
    });

    it('selfVideo=true이면 dto.videoOn=true다', () => {
      const state = makeVoiceState({ selfVideo: true });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.videoOn).toBe(true);
    });

    it('selfVideo=false이면 dto.videoOn=false다', () => {
      const state = makeVoiceState({ selfVideo: false });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.videoOn).toBe(false);
    });

    it('selfDeaf=true이면 dto.selfDeaf=true다', () => {
      const state = makeVoiceState({ selfDeaf: true });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.selfDeaf).toBe(true);
    });

    it('selfDeaf=false이면 dto.selfDeaf=false다', () => {
      const state = makeVoiceState({ selfDeaf: false });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.selfDeaf).toBe(false);
    });

    it('채널 인원이 1명이면 alone=true다', () => {
      const state = makeVoiceState({
        channel: {
          name: 'General',
          parentId: null,
          parent: null,
          members: makeDiscordCollection([['user-1', { user: { bot: false } }]]),
        },
      });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.alone).toBe(true);
      expect(dto.channelMemberCount).toBe(1);
    });

    it('채널 인원이 2명이면 alone=false다', () => {
      const state = makeVoiceState({
        channel: {
          name: 'General',
          parentId: null,
          parent: null,
          members: makeDiscordCollection([
            ['user-1', { user: { bot: false } }],
            ['user-2', { user: { bot: false } }],
          ]),
        },
      });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.alone).toBe(false);
      expect(dto.channelMemberCount).toBe(2);
    });

    it('봇 멤버는 channelMemberCount에서 제외된다', () => {
      const state = makeVoiceState({
        channel: {
          name: 'General',
          parentId: null,
          parent: null,
          members: makeDiscordCollection([
            ['user-1', { user: { bot: false } }],
            ['bot-1', { user: { bot: true } }],
          ]),
        },
      });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.channelMemberCount).toBe(1);
      expect(dto.alone).toBe(true);
    });

    it('parentId가 있으면 parentCategoryId로 매핑된다', () => {
      const state = makeVoiceState({ parentId: 'cat-1', parentName: 'Category' });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.parentCategoryId).toBe('cat-1');
      expect(dto.categoryName).toBe('Category');
    });

    it('parentId가 null이면 parentCategoryId=null, categoryName=null다', () => {
      const state = makeVoiceState({ parentId: null, parentName: null });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.parentCategoryId).toBeNull();
      expect(dto.categoryName).toBeNull();
    });

    it('guild가 없으면 InvalidVoiceStateError를 throw한다', () => {
      const state = makeVoiceState({ guild: null });
      expect(() => VoiceStateDto.fromVoiceState(state)).toThrow(InvalidVoiceStateError);
    });

    it('member가 없으면 InvalidVoiceStateError를 throw한다', () => {
      const state = makeVoiceState({ member: null });
      expect(() => VoiceStateDto.fromVoiceState(state)).toThrow(InvalidVoiceStateError);
    });

    it('channelId가 null이면 InvalidVoiceStateError를 throw한다', () => {
      const state = {
        guild: { id: 'guild-1' },
        member: { id: 'user-1', displayName: 'Alice', displayAvatarURL: () => '' },
        channelId: null,
        channel: null,
        selfMute: false,
        streaming: false,
        selfVideo: false,
        selfDeaf: false,
      } as unknown as VoiceState;
      expect(() => VoiceStateDto.fromVoiceState(state)).toThrow(InvalidVoiceStateError);
    });

    it('모든 streaming/videoOn/selfDeaf가 동시에 true일 때 올바르게 매핑된다', () => {
      const state = makeVoiceState({ streaming: true, selfVideo: true, selfDeaf: true });
      const dto = VoiceStateDto.fromVoiceState(state);
      expect(dto.streaming).toBe(true);
      expect(dto.videoOn).toBe(true);
      expect(dto.selfDeaf).toBe(true);
    });
  });
});
