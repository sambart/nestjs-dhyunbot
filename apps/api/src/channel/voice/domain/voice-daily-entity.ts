import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('voice_daily')
@Index(['guildId', 'date']) // 날짜별 조회 최적화
@Index(['guildId', 'channelId', 'date']) // 채널별 조회 최적화
@Index(['guildId', 'userId', 'date']) // 유저별 조회 최적화
export class VoiceDailyEntity {
  @PrimaryColumn()
  guildId: string;

  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  date: string; // YYYYMMDD

  @PrimaryColumn()
  channelId: string; // 'GLOBAL'이면 전체 집계

  @Column({ default: '' })
  channelName: string; // DB에 저장된 채널명 (없으면 '' 또는 null)

  @Column({ default: '' })
  userName: string; // DB에 저장된 유저명 (없으면 '' 또는 null)

  @Column({ default: 0 })
  channelDurationSec: number;

  @Column({ default: 0 })
  micOnSec: number;

  @Column({ default: 0 })
  micOffSec: number;

  @Column({ default: 0 })
  aloneSec: number;
}
