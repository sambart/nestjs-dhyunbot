import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { UserPrivacyConfigCache } from './application/user-privacy-config.cache';
import { UserPrivacyConfigService } from './application/user-privacy-config.service';
import { UserPrivacyConfigOrm } from './infrastructure/user-privacy-config.orm-entity';
import { UserPrivacyConfigRepository } from './infrastructure/user-privacy-config.repository';
import { UserPrivacyController } from './presentation/user-privacy.controller';

/**
 * 사용자 프라이버시 설정 모듈.
 * F-COPRESENCE-017 친밀도 노출 opt-out 정책을 처리한다.
 *
 * exports: UserPrivacyConfigService만 노출 (Repository/Cache는 내부 전용)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserPrivacyConfigOrm]),
    AuthModule, // JwtAuthGuard 사용
    // RedisModule은 @Global이므로 명시 import 불필요
  ],
  controllers: [UserPrivacyController],
  providers: [UserPrivacyConfigRepository, UserPrivacyConfigCache, UserPrivacyConfigService],
  exports: [UserPrivacyConfigService],
})
export class UserPrivacyModule {}
