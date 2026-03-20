import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';

import { RedisModule } from '../redis/redis.module';

function createTestTypeOrmModule(): DynamicModule {
  return TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
}

interface IntegrationModuleOptions {
  /** NestJS 모듈 (VoiceChannelModule 등) */
  modules?: Type[];
  /** TypeOrmModule.forFeature에 등록할 엔티티 */
  entities?: EntityClassOrSchema[];
  /** 개별 프로바이더 (Repository, Service 등) */
  providers?: Provider[];
  /** Redis 모듈을 포함할지 여부 (기본: true) */
  withRedis?: boolean;
}

/** 통합테스트용 NestJS TestingModule 빌더를 생성한다 */
export function createIntegrationModuleBuilder(
  options: IntegrationModuleOptions = {},
): TestingModuleBuilder {
  const { modules = [], entities = [], providers = [], withRedis = true } = options;

  const imports: Array<Type | DynamicModule | Promise<DynamicModule>> = [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    createTestTypeOrmModule(),
    ...modules,
  ];

  if (withRedis) {
    imports.push(RedisModule);
  }

  if (entities.length > 0) {
    imports.push(TypeOrmModule.forFeature(entities));
  }

  return Test.createTestingModule({
    imports,
    providers,
  });
}
