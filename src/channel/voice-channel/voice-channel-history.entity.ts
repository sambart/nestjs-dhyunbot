import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Channel } from '../channel.entity';
import { Member } from 'src/member/member.entity';

@Entity()
export class VoiceChannelHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel, (channel) => channel.voiceHistories, { eager: true })
  channel: Channel;

  @ManyToOne(() => Member, (member) => member.voiceHistories, { eager: true })
  member: Member;

  // IN/OUT 접속여부
  @Column({
    type: 'enum',
    enum: ['IN', 'OUT'], // 접속 여부를 ENUM으로 설정
  })
  inOutType: 'IN' | 'OUT';

  @Column({ type: 'timestamp', nullable: false })
  inTime: Date;

  @Column({ type: 'timestamp', nullable: true }) // outTime은 null 가능
  outTime: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 접속 기간 계산 (getter 사용)
  get duration(): number | null {
    if (this.inTime && this.outTime) {
      return Math.floor((+this.outTime - +this.inTime) / 1000); // 초 단위 반환
    }
    return null; // outTime이 없으면 null
  }
}
