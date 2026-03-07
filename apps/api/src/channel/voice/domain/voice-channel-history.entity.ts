import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Channel } from '../../channel.entity';
import { Member } from '../../../member/member.entity';

@Entity({ schema: 'public' })
export class VoiceChannelHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel, (channel) => channel.voiceHistories)
  channel: Channel;

  @ManyToOne(() => Member, (member) => member.voiceHistories)
  member: Member;

  @Column({ type: 'timestamp', nullable: false })
  joinAt: Date;

  @Column({ type: 'timestamp', nullable: true }) // outTime은 null 가능
  leftAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 접속 기간 계산 (getter 사용)
  get duration(): number | null {
    if (this.joinAt && this.leftAt) {
      return Math.floor((+this.leftAt - +this.joinAt) / 1000); // 초 단위 반환
    }
    return null; // outTime이 없으면 null
  }
}
