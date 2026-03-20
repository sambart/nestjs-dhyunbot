import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'voice_health_badge', schema: 'public' })
@Index('UQ_voice_health_badge_guild_user', ['guildId', 'userId'], { unique: true })
@Index('IDX_voice_health_badge_guild', ['guildId'])
export class VoiceHealthBadgeOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  userId: string;

  @Column({ type: 'json', default: '[]' })
  badges: string[];

  @Column({ type: 'int', nullable: true })
  activityRank: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  activityTopPercent: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  hhiScore: number | null;

  @Column({ type: 'int', nullable: true })
  mocoRank: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  mocoTopPercent: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  micUsageRate: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  activeDaysRatio: number | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  calculatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
