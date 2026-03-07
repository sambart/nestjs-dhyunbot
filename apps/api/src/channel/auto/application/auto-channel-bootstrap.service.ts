import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { AutoChannelConfigRepository } from '../infrastructure/auto-channel-config.repository';

@Injectable()
export class AutoChannelBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutoChannelBootstrapService.name);

  constructor(private readonly configRepo: AutoChannelConfigRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    const allConfigs = await this.configRepo.findAllConfigs();
    this.logger.log(`AutoChannel bootstrap complete. ${allConfigs.length} config(s) found.`);
  }
}
