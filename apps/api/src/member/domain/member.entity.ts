import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VoiceChannelHistory } from '../../channel/voice/domain/voice-channel-history.entity';

@Entity({ schema: 'public' })
export class Member {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordMemberId: string;

  @Column({ name: 'nickName' })
  nickname: string;

  @Column({ nullable: true })
  avatarUrl: string | null;

  @OneToMany(() => VoiceChannelHistory, (history) => history.member)
  voiceHistories: VoiceChannelHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
