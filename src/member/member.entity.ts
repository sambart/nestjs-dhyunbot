import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VoiceChannelHistory } from '../voice-channel/voice-channel-history.entity';

@Entity()
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
