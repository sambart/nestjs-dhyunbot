import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.types';

@Entity({ name: 'voice_excluded_channel', schema: 'public' })
@Unique('UQ_voice_excluded_channel_guild_discord', ['guildId', 'discordChannelId'])
export class VoiceExcludedChannelOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  discordChannelId: string;

  @Column({
    type: 'enum',
    enum: VoiceExcludedChannelType,
  })
  type: VoiceExcludedChannelType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
