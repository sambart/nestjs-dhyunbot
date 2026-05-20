import { Module, OnModuleInit } from '@nestjs/common';

import { CanvasFontsService } from './canvas-fonts';

@Module({
  providers: [CanvasFontsService],
  exports: [CanvasFontsService],
})
export class CanvasModule implements OnModuleInit {
  constructor(private readonly fonts: CanvasFontsService) {}

  // 모듈 초기화 시 폰트를 1회 등록한다. CanvasFontsService.register()는 멱등하므로 중복 호출해도 안전하다
  onModuleInit(): void {
    this.fonts.register();
  }
}
