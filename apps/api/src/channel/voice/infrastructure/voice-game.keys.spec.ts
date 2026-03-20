import { VoiceGameKeys } from './voice-game.keys';

describe('VoiceGameKeys', () => {
  describe('gameSession', () => {
    it('올바른 키 패턴을 생성한다', () => {
      const key = VoiceGameKeys.gameSession('guild-1', 'user-1');
      expect(key).toBe('voice:game:session:guild-1:user-1');
    });

    it('guildId와 userId가 콜론으로 구분된다', () => {
      const key = VoiceGameKeys.gameSession('my-guild', 'my-user');
      expect(key).toBe('voice:game:session:my-guild:my-user');
    });

    it('guildId와 userId가 각각 다른 길드/유저에 대해 고유한 키를 생성한다', () => {
      const key1 = VoiceGameKeys.gameSession('guild-1', 'user-1');
      const key2 = VoiceGameKeys.gameSession('guild-1', 'user-2');
      const key3 = VoiceGameKeys.gameSession('guild-2', 'user-1');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe('gameSessionPattern', () => {
    it('모든 게임 세션 SCAN 패턴을 반환한다', () => {
      const pattern = VoiceGameKeys.gameSessionPattern();
      expect(pattern).toBe('voice:game:session:*');
    });

    it('gameSession 키가 패턴에 매칭된다', () => {
      const pattern = VoiceGameKeys.gameSessionPattern();
      const key = VoiceGameKeys.gameSession('guild-1', 'user-1');

      // SCAN 패턴 검증 (단순 prefix 확인)
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      expect(regex.test(key)).toBe(true);
    });
  });
});
