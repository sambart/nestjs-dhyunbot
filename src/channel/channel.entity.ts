import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VoiceChannelHistory } from './voice-channel/voice-channel-history.entity';

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordChannelId: string;

  @Column()
  channelName: string;

  @Column()
  channelType: string;

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
