import { GlobalFonts } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CanvasFontsService {
  private readonly logger = new Logger(CanvasFontsService.name);

  // 모듈이 여러 번 초기화되더라도 폰트 등록이 중복으로 실행되지 않도록 멱등 플래그를 사용한다
  private isRegistered = false;

  register(): void {
    if (this.isRegistered) return;

    const cjkPaths = [
      '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ];
    for (const path of cjkPaths) {
      try {
        GlobalFonts.registerFromPath(path, 'NotoSansCJK');
        this.logger.log(`CJK font registered: ${path}`);
        break;
      } catch {
        // 해당 경로에 폰트가 없는 경우 다음 경로를 시도한다
      }
    }

    const emojiPaths = [
      '/usr/share/fonts/noto/NotoColorEmoji.ttf',
      '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
    ];
    for (const path of emojiPaths) {
      try {
        GlobalFonts.registerFromPath(path, 'NotoColorEmoji');
        this.logger.log(`Emoji font registered: ${path}`);
        break;
      } catch {
        // 해당 경로에 폰트가 없는 경우 다음 경로를 시도한다
      }
    }

    this.isRegistered = true;
  }
}
