import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'public' })
@Index('IDX_moco_hunting_session_guild_hunter', ['guildId', 'hunterId'])
@Index('IDX_moco_hunting_session_guild_started', ['guildId', 'startedAt'])
@Index('IDX_moco_hunting_session_guild_valid', ['guildId', 'isValid'])
export class MocoHuntingSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  guildId: string;

  @Column({ type: 'varchar' })
  hunterId: string;

  @Column({ type: 'varchar' })
  channelId: string;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMin: number | null;

  @Column({ type: 'json' })
  newbieMemberIds: string[];

  @Column({ type: 'boolean', default: false })
  isValid: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
