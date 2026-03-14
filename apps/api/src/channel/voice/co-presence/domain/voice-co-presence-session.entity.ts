import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'public' })
@Index('IDX_copresence_session_guild_user', ['guildId', 'userId'])
@Index('IDX_copresence_session_guild_started', ['guildId', 'startedAt'])
@Index('IDX_copresence_session_ended', ['endedAt'])
export class VoiceCoPresenceSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  guildId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  channelId: string;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp' })
  endedAt: Date;

  @Column({ type: 'int' })
  durationMin: number;

  @Column({ type: 'json' })
  peerIds: string[];

  @Column({ type: 'json' })
  peerMinutes: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
