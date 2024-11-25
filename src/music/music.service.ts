import { Injectable } from '@nestjs/common';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} from '@discordjs/voice';
import { Player } from 'discord-player';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';
import player from 'discord-player';

@Injectable()
export class MusicService {
  constructor(@InjectDiscordClient() private readonly client: Client) {
    const player = new Player(client);
    player.extractors.loadDefault().then((r) => console.log('Extractors loaded successfully'));
  }
  async playMusic(
    url: string,
    guildId: string,
    channelId: string,
    memberId: string,
    adapterCreator,
  ) {
    console.log('playMusic', url);

    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator,
    });
    const player = new Player(this.client);

    const track = await player.search(url);

    if (!track) {
      throw new Error('Track not found');
    }

    await player.play(channelId, track, {
      nodeOptions: {
        metadata: {
          channel: channelId,
          client: memberId,
          requestedBy: 'DDH',
        },
        leaveOnEmptyCooldown: 300000,
        leaveOnEmpty: true,
        leaveOnEnd: false,
        bufferingTimeout: 0,
        volume: 10,
        //defaultFFmpegFilters: ['lofi', 'bassboost', 'normalizer']
      },
    });
  }
  catch(error) {
    console.error('음악 재생 오류:', error);
  }
}
