import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum BotStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

@Entity({ schema: 'public' })
@Index('IDX_bot_metric_guild_recorded', ['guildId', 'recordedAt'])
@Index('IDX_bot_metric_recorded', ['recordedAt'])
export class BotMetric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ type: 'enum', enum: BotStatus, default: BotStatus.OFFLINE })
  status: BotStatus;

  @Column({ default: 0 })
  pingMs: number;

  @Column({ type: 'float', default: 0 })
  heapUsedMb: number;

  @Column({ type: 'float', default: 0 })
  heapTotalMb: number;

  @Column({ default: 0 })
  voiceUserCount: number;

  @Column({ default: 0 })
  guildCount: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  recordedAt: Date;
}
