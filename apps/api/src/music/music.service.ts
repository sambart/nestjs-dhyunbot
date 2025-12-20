import { Injectable } from '@nestjs/common';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} from '@discordjs/voice';
import { Player, QueryType, useQueue } from 'discord-player';
import { InjectDiscordClient } from '@discord-nestjs/core';
import {
  Client,
  Interaction,
  CacheType,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';

@Injectable()
export class MusicService {
  constructor(@InjectDiscordClient() private readonly client: Client) {
    const player = new Player(client);
    player.extractors.loadDefault().then((r) => console.log('Extractors loaded successfully'));
  }

  async playMusic(url: string, interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    console.log('playMusic', url);

    await interaction.deferReply();

    const member = interaction.member as GuildMember;

    const player = new Player(this.client);

    const track = await player.search(url, {
      requestedBy: interaction.user,
      searchEngine: QueryType.YOUTUBE_SEARCH,
    });

    if (!track.hasTracks()) {
      throw new Error('Track not found');
    }

    console.log('playMusic', track);

    await player.play(member.voice.channelId, track, {
      nodeOptions: {
        metadata: {
          channel: member.voice.channelId,
          client: interaction.guild?.members.me,
          requestedBy: interaction.user.username,
        },
        leaveOnEmptyCooldown: 300000,
        leaveOnEmpty: true,
        leaveOnEnd: false,
        bufferingTimeout: 0,
        volume: 10,
        //defaultFFmpegFilters: ['lofi', 'bassboost', 'normalizer']
      },
    });

    player.events.on('playerStart', async (queue, track) => {
      await interaction.followUp({
        content: `${track.url}`,
      });
      console.log(`The current track changed to ${track.title}`);
      // 트랙이 변경될 때 처리할 로직 추가
    });

    player.events.on('emptyQueue', async (queue) => {
      queue.delete();
      await interaction.followUp({
        content: '🎶 | 노래가 끝났습니다.',
      });
    });
  }
  catch(error) {
    console.error('음악 재생 오류:', error);
  }

  async stop(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    await interaction.deferReply();
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack)
      return void interaction.followUp({
        content: '❌ | 더 이상 재생 중인 트랙이 없습니다.',
      });
    queue.node.stop();
    queue.delete();

    return void interaction.followUp({ content: '🛑 | 노래가 중단 되었습니다.' });
  }

  async skip(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    await interaction.deferReply();
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack)
      return void interaction.followUp({
        content: '❌ | 더 이상 재생 중인 트랙이 없습니다.',
      });

    const currentTrack = queue.currentTrack;
    const success = queue.node.skip();
    if (!success) return void interaction.followUp({ content: '❌ | 스킵할 수 없습니다.' });

    return void interaction.followUp({ content: '⏭ | 노래가 스킵 되었습니다.' });
  }
}
