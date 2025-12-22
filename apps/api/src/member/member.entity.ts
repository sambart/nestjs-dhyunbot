import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VoiceChannelHistory } from '../channel/voice/domain/voice-channel-history.entity';

@Entity({ schema: 'public' })
export class Member {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordMemberId: string;

  @Column()
  nickName: string;

  @OneToMany(() => VoiceChannelHistory, (history) => history.member)
  voiceHistories: VoiceChannelHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
