/*
    임시 채널인지 여부 판단
    현재 채널 인원 수 추적
    비어 있으면 삭제 대상인지 판단
    서버 재시작 / 다중 인스턴스에서도 안전
*/
import { Injectable } from '@nestjs/common';
import { TempChannelStore } from './temp-channel-store';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RedisTempChannelStore implements TempChannelStore {
  constructor(private readonly redis: RedisService) {}

  private channelsKey(guildId: string) {
    return `voice:temp:channels:${guildId}`;
  }

  private membersKey(channelId: string) {
    return `voice:temp:channel:${channelId}:members`;
  }

  async registerTempChannel(guildId: string, channelId: string): Promise<void> {
    await this.redis.sadd(this.channelsKey(guildId), channelId);
  }

  async unregisterTempChannel(guildId: string, channelId: string): Promise<void> {
    await this.redis.srem(this.channelsKey(guildId), channelId);
    await this.redis.del(this.membersKey(channelId));
  }

  async isTempChannel(guildId: string, channelId: string): Promise<boolean> {
    return await this.redis.sismember(this.channelsKey(guildId), channelId);
  }

  async addMember(channelId: string, userId: string): Promise<void> {
    await this.redis.sadd(this.membersKey(channelId), userId);
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    await this.redis.srem(this.membersKey(channelId), userId);
  }

  async isEmpty(channelId: string): Promise<boolean> {
    return (await this.redis.scard(this.membersKey(channelId))) === 0;
  }
}
