import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { InactiveMemberActionType } from '../domain/inactive-member.types';

@Entity({ name: 'inactive_member_action_log', schema: 'public' })
@Index('IDX_inactive_action_log_guild_executed', ['guildId', 'executedAt'])
export class InactiveMemberActionLogOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ type: 'enum', enum: InactiveMemberActionType })
  actionType: InactiveMemberActionType;

  @Column({ type: 'json' })
  targetUserIds: string[];

  @Column({ nullable: true })
  executorUserId: string | null;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failCount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  executedAt: Date;
}
