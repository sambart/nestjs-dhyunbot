import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VoiceChannelHistory } from '../channel/voice/voice-channel-history.entity';

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
