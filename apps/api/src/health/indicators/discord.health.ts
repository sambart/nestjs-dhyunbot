import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { Client, Status } from 'discord.js';

@Injectable()
export class DiscordHealthIndicator extends HealthIndicator {
  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
  ) {
    super();
  }

  isHealthy(key: string): HealthIndicatorResult {
    const isReady = this.client.ws.status === Status.Ready;

    if (isReady) {
      return this.getStatus(key, true, { ping: this.client.ws.ping });
    }

    throw new HealthCheckError(
      'Discord gateway is not ready',
      this.getStatus(key, false, { status: Status[this.client.ws.status] }),
    );
  }
}
