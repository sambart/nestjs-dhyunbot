import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * HTTP 요청에만 Rate Limiting을 적용하는 ThrottlerGuard.
 * discord-nestjs는 ExternalContextCreator를 사용하여 getType()이 'http'를 반환하므로,
 * response 객체에 header 메서드가 있는지로 실제 HTTP 요청 여부를 판별한다.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    if (!response || typeof response.header !== 'function') {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}
