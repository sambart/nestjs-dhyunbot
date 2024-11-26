import { ConfigModule, ConfigService } from '@nestjs/config';
import { GqlModuleOptions } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

export const GraphQLConfig = {
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => {
    const driver = configService.get<string>('GRAPHQL_DRIVER');
    const isApollo = driver === 'apollo';
    return {
      driver: ApolloDriver, // 드라이버 설정
      autoSchemaFile: true, // 스키마 자동 생성
      playground: configService.get<boolean>('GRAPHQL_PLAYGROUND', true),
      introspection: configService.get<boolean>('GRAPHQL_INTROSPECTION', true),
    } as ApolloDriverConfig;
  },
  inject: [ConfigService],
};
