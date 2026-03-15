import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'voice_co_presence_pair_daily', schema: 'public' })
@Index('IDX_copresence_pair_guild_user_date', ['guildId', 'userId', 'date'])
@Index('IDX_copresence_pair_guild_date', ['guildId', 'date'])
export class VoiceCoPresencePairDailyOrm {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @PrimaryColumn({ type: 'varchar' })
  peerId: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  minutes: number;

  @Column({ type: 'int', default: 0 })
  sessionCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  recordedAt: Date | null;
}
