import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'voice_game_daily', schema: 'public' })
@Index('IDX_game_daily_guild_date', ['guildId', 'date'])
@Index('IDX_game_daily_guild_game_date', ['guildId', 'gameName', 'date'])
export class VoiceGameDailyOrm {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @PrimaryColumn({ type: 'varchar' })
  gameName: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  totalMinutes: number;

  @Column({ type: 'int', default: 0 })
  sessionCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  recordedAt: Date | null;
}
