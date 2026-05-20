import { GlobalFonts } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CanvasFontsService {
  private readonly logger = new Logger(CanvasFontsService.name);

  // 모듈이 여러 번 초기화되더라도 폰트 등록이 중복으로 실행되지 않도록 멱등 플래그를 사용한다
  private isRegistered = false;

  register(): void {
    if (this.isRegistered) return;

    // prod(도커 리눅스)는 Noto 경로, 네이티브 dev(Windows/macOS)는 OS 기본 한글 폰트를 fallback으로 등록한다.
    // 어느 경로에서 등록되든 캔버스 코드는 'NotoSansCJK' 패밀리명을 사용하므로 패밀리명을 통일한다.
    const cjkPaths = [
      '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      'C:/Windows/Fonts/malgun.ttf', // Windows 맑은 고딕 (napi-rs는 백슬래시 경로를 인식 못 하므로 슬래시 사용)
      '/System/Library/Fonts/Supplemental/AppleGothic.ttf', // macOS
      '/Library/Fonts/AppleGothic.ttf', // macOS (구버전)
    ];
    if (!this.registerFirstAvailable(cjkPaths, 'NotoSansCJK')) {
      this.logger.warn('CJK 폰트를 찾지 못했습니다 — 한글이 깨질 수 있습니다');
    }

    const emojiPaths = [
      '/usr/share/fonts/noto/NotoColorEmoji.ttf',
      '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
      'C:/Windows/Fonts/seguiemj.ttf', // Windows Segoe UI Emoji (슬래시 경로)
      '/System/Library/Fonts/Apple Color Emoji.ttc', // macOS
    ];
    // 이모지 폰트는 없어도 텍스트 렌더는 동작하므로 실패해도 warn만 남긴다
    this.registerFirstAvailable(emojiPaths, 'NotoColorEmoji');

    this.isRegistered = true;
  }

  /**
   * 후보 경로를 순서대로 시도하여 처음 성공한 폰트를 주어진 패밀리명으로 등록한다.
   * napi-rs `registerFromPath`는 존재하지 않는 경로에도 예외를 던지지 않고 falsy를 반환하므로,
   * try/catch가 아니라 반환값과 `GlobalFonts.has()`로 실제 등록 성공을 검증한다.
   */
  private registerFirstAvailable(paths: string[], family: string): boolean {
    for (const path of paths) {
      try {
        const registered = GlobalFonts.registerFromPath(path, family);
        if (registered && GlobalFonts.has(family)) {
          this.logger.log(`Font registered (${family}): ${path}`);
          return true;
        }
      } catch {
        // 해당 경로 접근 자체가 실패한 경우 다음 경로를 시도한다
      }
    }
    return false;
  }
}
