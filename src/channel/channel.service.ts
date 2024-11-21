import { Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient, Once, On, DiscordClientProvider } from '@discord-nestjs/core';
import {
  Client,
  Message,
  EmbedBuilder,
  ChannelType,
  Guild,
  CategoryChannel,
  VoiceChannel,
  GuildMember,
  GuildChannel,
} from 'discord.js';
import { Channel, VoiceState } from 'discord.js';
import { Member } from 'src/member/member.entity';
import { CONSTANTS } from '../config/constants';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);
  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly discordProvider: DiscordClientProvider,
  ) {}
}
