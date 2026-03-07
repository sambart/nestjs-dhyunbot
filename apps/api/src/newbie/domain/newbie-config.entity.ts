import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'public' })
@Index('UQ_newbie_config_guild', ['guildId'], { unique: true })
export class NewbieConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  // 환영인사 설정
  @Column({ default: false })
  welcomeEnabled: boolean;

  @Column({ nullable: true })
  welcomeChannelId: string | null;

  @Column({ nullable: true })
  welcomeEmbedTitle: string | null;

  @Column({ type: 'text', nullable: true })
  welcomeEmbedDescription: string | null;

  @Column({ nullable: true })
  welcomeEmbedColor: string | null;

  @Column({ nullable: true })
  welcomeEmbedThumbnailUrl: string | null;

  // 미션 설정
  @Column({ default: false })
  missionEnabled: boolean;

  @Column({ nullable: true })
  missionDurationDays: number | null;

  @Column({ nullable: true })
  missionTargetPlaytimeHours: number | null;

  @Column({ nullable: true })
  missionNotifyChannelId: string | null;

  @Column({ nullable: true })
  missionNotifyMessageId: string | null;

  // 모코코 사냥 설정
  @Column({ default: false })
  mocoEnabled: boolean;

  @Column({ nullable: true })
  mocoRankChannelId: string | null;

  @Column({ nullable: true })
  mocoRankMessageId: string | null;

  @Column({ nullable: true })
  mocoAutoRefreshMinutes: number | null;

  // 신입기간 역할 설정
  @Column({ default: false })
  roleEnabled: boolean;

  @Column({ nullable: true })
  roleDurationDays: number | null;

  @Column({ nullable: true })
  newbieRoleId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
