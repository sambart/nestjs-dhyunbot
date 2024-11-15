import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeORMConfig: TypeOrmModuleOptions = {
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    autoLoadEntities: true,
    synchronize: true, // 개발 환경에서만 사용
  }