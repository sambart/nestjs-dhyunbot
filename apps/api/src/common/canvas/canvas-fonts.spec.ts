/**
 * CanvasFontsService 단위 테스트
 * 대상: register() 멱등성 보장 (isRegistered 플래그)
 *
 * @napi-rs/canvas의 GlobalFonts는 vi.mock으로 차단한다.
 */

vi.mock('@napi-rs/canvas', () => ({
  GlobalFonts: {
    registerFromPath: vi.fn().mockImplementation((path: string) => {
      // 존재하지 않는 경로는 예외를 throw해야 폴백 로직이 동작한다
      if (!path.includes('NotoSansCJK') && !path.includes('NotoColorEmoji')) {
        throw new Error(`Font not found: ${path}`);
      }
      // 실제 파일이 없는 테스트 환경에서는 첫 번째 경로에서 성공을 가정한다
    }),
  },
}));

import { GlobalFonts } from '@napi-rs/canvas';
import type { Mock } from 'vitest';

import { CanvasFontsService } from './canvas-fonts';

describe('CanvasFontsService', () => {
  let service: CanvasFontsService;

  beforeEach(() => {
    service = new CanvasFontsService();
    (GlobalFonts.registerFromPath as Mock).mockClear();
  });

  it('register()를 처음 호출하면 GlobalFonts.registerFromPath가 호출된다', () => {
    service.register();

    // CJK + Emoji 폰트 등록을 시도하므로 최소 1회 이상 호출되어야 한다
    expect(GlobalFonts.registerFromPath).toHaveBeenCalled();
  });

  it('register()를 2번 호출해도 등록은 1번만 수행한다 (멱등성)', () => {
    service.register();
    const firstCallCount = (GlobalFonts.registerFromPath as Mock).mock.calls.length;

    service.register(); // 두 번째 호출

    // isRegistered 플래그로 보호되므로 호출 횟수가 증가하지 않아야 한다
    expect((GlobalFonts.registerFromPath as Mock).mock.calls.length).toBe(firstCallCount);
  });

  it('register()를 3번 호출해도 등록은 1번만 수행한다', () => {
    service.register();
    const callCountAfterFirst = (GlobalFonts.registerFromPath as Mock).mock.calls.length;

    service.register();
    service.register();

    expect((GlobalFonts.registerFromPath as Mock).mock.calls.length).toBe(callCountAfterFirst);
  });
});
