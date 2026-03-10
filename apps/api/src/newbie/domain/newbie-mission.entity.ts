import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MissionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  LEFT = 'LEFT',
}

@Entity({ schema: 'public' })
@Index('IDX_newbie_mission_guild_member', ['guildId', 'memberId'])
@Index('IDX_newbie_mission_guild_status', ['guildId', 'status'])
@Index('IDX_newbie_mission_status_end_date', ['status', 'endDate'])
export class NewbieMission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  memberId: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column()
  targetPlaytimeSec: number;

  @Column({
    type: 'enum',
    enum: MissionStatus,
    default: MissionStatus.IN_PROGRESS,
  })
  status: MissionStatus;

  @Column({ default: false })
  hiddenFromEmbed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
