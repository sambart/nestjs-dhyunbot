import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'voice_co_presence_daily', schema: 'public' })
@Index('IDX_copresence_daily_guild_date', ['guildId', 'date'])
export class VoiceCoPresenceDailyOrm {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  channelMinutes: number;

  @Column({ type: 'int', default: 0 })
  sessionCount: number;
}
