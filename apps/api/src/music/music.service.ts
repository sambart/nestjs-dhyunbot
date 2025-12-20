import { Injectable } from '@nestjs/common';
import { Player, QueryType, useQueue } from 'discord-player';
import { InjectDiscordClient } from '@discord-nestjs/core';
import {
  Client,
  Interaction,
  CacheType,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import * as ytSearch from 'yt-search';
import { DefaultExtractors } from '@discord-player/extractor';

@Injectable()
export class MusicService {
  private player: Player;
  private initialized = false;

  constructor(@InjectDiscordClient() private readonly client: Client) {
    this.player = new Player(client);
  }

  async init() {
    if (this.initialized) return;
    await this.player.extractors.loadMulti(DefaultExtractors);
    this.initialized = true;
    console.log('✅ Extractors loaded');

    this.player.events.on('playerStart', (queue, track) => {
      console.log(`Now playing: ${track.title}`);
    });

    this.player.events.on('emptyQueue', (queue) => {
      console.log('Queue ended');
    });

    this.player.events.on('playerError', (queue, error) => {
      console.log(error);
    });

    this.player.events.on('error', (queue, error) => {
      console.log(error);
    });
  }

  async playMusic(url: string, interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    console.log('playMusic', url);
    await this.init(); // extractor 로드 보장

    const member = interaction.member as GuildMember;

    const searchResult = await this.player.search(url, {
      requestedBy: interaction.user,
      searchEngine: QueryType.AUTO,
    });

    if (!searchResult || !searchResult.tracks.length) {
      console.log('SearchResult:', searchResult.tracks);
      const newSearch = await ytSearch(url);
      if (!newSearch || !newSearch.videos.length) throw new Error('Track not found');
      console.log('NEWSEARCH', newSearch);
      await this.player.play(member.voice.channel, newSearch.videos[0].url, {
        requestedBy: interaction.user,
      });
    } else {
      console.log(searchResult.tracks);
      const trackToPlay = searchResult.tracks[0];
      await interaction.reply(`재생 시작: ${trackToPlay.title}`);
      await this.player.play(member.voice.channelId, trackToPlay, {
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
    }
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
