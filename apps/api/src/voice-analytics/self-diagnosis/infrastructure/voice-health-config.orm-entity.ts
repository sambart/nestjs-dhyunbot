import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'voice_health_config', schema: 'public' })
@Index('UQ_voice_health_config_guild', ['guildId'], { unique: true })
export class VoiceHealthConfigOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'int', default: 30 })
  analysisDays: number;

  @Column({ default: true })
  isCooldownEnabled: boolean;

  @Column({ type: 'int', default: 24 })
  cooldownHours: number;

  @Column({ default: false })
  isLlmSummaryEnabled: boolean;

  @Column({ type: 'int', default: 600 })
  minActivityMinutes: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  minActiveDaysRatio: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.3 })
  hhiThreshold: number;

  @Column({ type: 'int', default: 3 })
  minPeerCount: number;

  @Column({ type: 'int', default: 10 })
  badgeActivityTopPercent: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.25 })
  badgeSocialHhiMax: number;

  @Column({ type: 'int', default: 5 })
  badgeSocialMinPeers: number;

  @Column({ type: 'int', default: 10 })
  badgeHunterTopPercent: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.8 })
  badgeConsistentMinRatio: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.7 })
  badgeMicMinRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
