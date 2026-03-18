import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { VoiceChannelHistoryOrm } from '../../channel/voice/infrastructure/voice-channel-history.orm-entity';

@Entity({ name: 'member', schema: 'public' })
export class MemberOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordMemberId: string;

  @Column({ name: 'nickName' })
  nickname: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @OneToMany(() => VoiceChannelHistoryOrm, (history) => history.member)
  voiceHistories: VoiceChannelHistoryOrm[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
