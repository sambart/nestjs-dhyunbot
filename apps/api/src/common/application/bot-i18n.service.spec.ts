import { BotI18nService } from './bot-i18n.service';

describe('BotI18nService', () => {
  let service: BotI18nService;

  beforeEach(() => {
    service = new BotI18nService();
    // onModuleInit 호출 (파일 로딩 시도, 없어도 graceful하게 처리)
    service.onModuleInit();
  });

  describe('t — 키 조회', () => {
    it('로드된 번역 키가 없으면 key 자체를 반환한다', () => {
      const result = service.t('ko', 'voice.some.nonexistent_key');

      expect(result).toBe('voice.some.nonexistent_key');
    });

    it('namespace가 없는 키도 key 자체를 반환한다', () => {
      const result = service.t('en', 'nonexistent.key');

      expect(result).toBe('nonexistent.key');
    });

    it('지원하지 않는 locale이면 DEFAULT_LOCALE(en) 폴백을 시도한다', () => {
      // messages에 직접 주입하여 테스트
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).messages = {
        en: { voice: { 'test.key': 'English Value' } },
        ko: {},
      };

      // jp locale → en 폴백
      const result = service.t('jp', 'voice.test.key');

      expect(result).toBe('English Value');
    });
  });

  describe('t — 매개변수 보간', () => {
    beforeEach(() => {
      // 테스트용 메시지 직접 주입
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).messages = {
        en: {
          voice: {
            greeting: 'Hello, {name}! You have {count} messages.',
            simple: 'Simple text without params',
          },
        },
        ko: {
          voice: {
            greeting: '안녕, {name}! {count}개의 메시지가 있습니다.',
          },
        },
      };
    });

    it('단일 파라미터를 보간한다', () => {
      const result = service.t('en', 'voice.greeting', { name: 'Alice', count: 5 });

      expect(result).toBe('Hello, Alice! You have 5 messages.');
    });

    it('한국어 번역에도 파라미터를 보간한다', () => {
      const result = service.t('ko', 'voice.greeting', { name: '앨리스', count: 3 });

      expect(result).toBe('안녕, 앨리스! 3개의 메시지가 있습니다.');
    });

    it('파라미터가 없으면 보간 없이 반환한다', () => {
      const result = service.t('en', 'voice.simple');

      expect(result).toBe('Simple text without params');
    });

    it('템플릿에 없는 파라미터 키는 원래 플레이스홀더로 남긴다', () => {
      const result = service.t('en', 'voice.greeting', { name: 'Bob' });

      // count 파라미터가 없으므로 {count}가 그대로 유지
      expect(result).toBe('Hello, Bob! You have {count} messages.');
    });

    it('숫자 타입 파라미터도 보간된다', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).messages = {
        en: { errors: { limit: 'Limit is {limit}' } },
        ko: {},
      };

      const result = service.t('en', 'errors.limit', { limit: 100 });

      expect(result).toBe('Limit is 100');
    });

    it('빈 params 객체를 전달해도 정상 동작한다', () => {
      const result = service.t('en', 'voice.simple', {});

      expect(result).toBe('Simple text without params');
    });
  });

  describe('t — locale 폴백', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).messages = {
        en: {
          commands: { help: 'Help text in English' },
          music: { play: 'Now playing: {title}' },
        },
        ko: {
          commands: { help: '한국어 도움말' },
          // music namespace는 ko에 없음
        },
      };
    });

    it('ko locale에 번역이 있으면 ko 번역을 반환한다', () => {
      const result = service.t('ko', 'commands.help');

      expect(result).toBe('한국어 도움말');
    });

    it('ko locale에 번역이 없으면 en 폴백을 사용한다', () => {
      const result = service.t('ko', 'music.play', { title: 'Song' });

      expect(result).toBe('Now playing: Song');
    });

    it('en에도 번역이 없으면 key를 그대로 반환한다', () => {
      const result = service.t('ko', 'unknown.key');

      expect(result).toBe('unknown.key');
    });
  });

  describe('onModuleInit', () => {
    it('모듈 초기화 시 오류가 발생하지 않는다', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});
