import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'public' })
@Index('IDX_newbie_period_guild_member', ['guildId', 'memberId'])
@Index('IDX_newbie_period_expires', ['expiresDate', 'isExpired'])
@Index('IDX_newbie_period_guild_active', ['guildId', 'isExpired'])
export class NewbiePeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  memberId: string;

  @Column()
  startDate: string;

  @Column()
  expiresDate: string;

  @Column({ default: false })
  isExpired: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
