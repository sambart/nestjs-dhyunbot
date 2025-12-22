import { ConfigModule, ConfigService } from '@nestjs/config';

export const ServerConfig = {
  SERVER_PORT: parseInt(process.env.PORT, 10) || 3000,
};
