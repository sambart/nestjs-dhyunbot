import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum VoiceExcludedChannelType {
  CHANNEL = 'CHANNEL',
  CATEGORY = 'CATEGORY',
}

@Entity({ schema: 'public' })
@Unique('UQ_voice_excluded_channel_guild_discord', [
  'guildId',
  'discordChannelId',
])
export class VoiceExcludedChannel {
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
