import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('voice_daily')
export class VoiceDailyEntity {
  @PrimaryColumn()
  guildId: string;

  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  date: string; // YYYYMMDD

  @PrimaryColumn()
  channelId: string;

  @Column({ default: 0 })
  channelDurationSec: number;

  @Column({ default: 0 })
  micOnSec: number;

  @Column({ default: 0 })
  micOffSec: number;

  @Column({ default: 0 })
  aloneSec: number;
}
