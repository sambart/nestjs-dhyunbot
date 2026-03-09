import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VoiceChannelHistory } from './voice/domain/voice-channel-history.entity';

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

@Entity({ schema: 'public' })
@Index('IDX_channel_guild', ['guildId'])
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordChannelId: string;

  @Column({ nullable: true })
  guildId: string;

  @Column()
  channelName: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ nullable: true })
  categoryName: string;

  @Column({
    type: 'enum',
    enum: ChannelStatus,
    default: ChannelStatus.ACTIVE,
  })
  status: ChannelStatus;

  @OneToMany(() => VoiceChannelHistory, (history) => history.channel)
  voiceHistories: VoiceChannelHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
