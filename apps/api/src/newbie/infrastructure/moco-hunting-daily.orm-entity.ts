import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'moco_hunting_daily', schema: 'public' })
@Index('IDX_moco_hunting_daily_guild_date', ['guildId', 'date'])
export class MocoHuntingDailyOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @PrimaryColumn({ type: 'varchar' })
  hunterId: string;

  @PrimaryColumn({ type: 'varchar', length: 8 })
  date: string;

  @Column({ type: 'int', default: 0 })
  channelMinutes: number;

  @Column({ type: 'int', default: 0 })
  sessionCount: number;

  @Column({ type: 'int', default: 0 })
  uniqueNewbieCount: number;

  @Column({ type: 'int', default: 0 })
  score: number;
}
