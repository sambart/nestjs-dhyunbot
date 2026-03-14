import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'public' })
@Index('IDX_copresence_daily_guild_date', ['guildId', 'date'])
export class VoiceCoPresenceDaily {
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
