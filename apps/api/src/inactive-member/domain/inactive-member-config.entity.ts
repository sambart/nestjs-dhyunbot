import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'public' })
@Index('UQ_inactive_member_config_guild', ['guildId'], { unique: true })
export class InactiveMemberConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ type: 'int', default: 30 })
  periodDays: number;

  @Column({ type: 'int', default: 30 })
  lowActiveThresholdMin: number;

  @Column({ type: 'int', default: 50 })
  decliningPercent: number;

  @Column({ default: false })
  autoActionEnabled: boolean;

  @Column({ default: false })
  autoRoleAdd: boolean;

  @Column({ default: false })
  autoDm: boolean;

  @Column({ nullable: true })
  inactiveRoleId: string | null;

  @Column({ nullable: true })
  removeRoleId: string | null;

  @Column({ type: 'json', default: '[]' })
  excludedRoleIds: string[];

  @Column({ nullable: true })
  dmEmbedTitle: string | null;

  @Column({ type: 'text', nullable: true })
  dmEmbedBody: string | null;

  @Column({ nullable: true })
  dmEmbedColor: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
