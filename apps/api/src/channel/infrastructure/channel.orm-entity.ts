import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VoiceChannelHistoryOrm } from '../voice/infrastructure/voice-channel-history.orm-entity';

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

@Entity({ name: 'channel', schema: 'public' })
@Index('IDX_channel_guild', ['guildId'])
export class ChannelOrm {
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

  @OneToMany(() => VoiceChannelHistoryOrm, (history) => history.channel)
  voiceHistories: VoiceChannelHistoryOrm[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
