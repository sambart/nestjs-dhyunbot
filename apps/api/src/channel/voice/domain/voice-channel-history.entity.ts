import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Member } from '../../../member/member.entity';
import { Channel } from '../../channel.entity';

// IDX_voice_channel_history_member_join (memberId, joinedAt DESC) — 마이그레이션으로 생성
@Entity({ schema: 'public' })
export class VoiceChannelHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel, (channel) => channel.voiceHistories)
  channel: Channel;

  @ManyToOne(() => Member, (member) => member.voiceHistories)
  member: Member;

  @Column({ name: 'joinAt', type: 'timestamp', nullable: false })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get duration(): number | null {
    if (this.joinedAt && this.leftAt) {
      return Math.floor((+this.leftAt - +this.joinedAt) / 1000);
    }
    return null;
  }
}
