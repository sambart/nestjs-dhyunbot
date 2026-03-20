import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'voice_game_activity', schema: 'public' })
@Index('IDX_game_activity_guild_user', ['guildId', 'userId'])
@Index('IDX_game_activity_guild_game', ['guildId', 'gameName'])
@Index('IDX_game_activity_guild_started', ['guildId', 'startedAt'])
@Index('IDX_game_activity_started', ['startedAt'])
export class VoiceGameActivityOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  guildId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  channelId: string;

  @Column({ type: 'varchar' })
  gameName: string;

  @Column({ type: 'varchar', nullable: true })
  applicationId: string | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMin: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
