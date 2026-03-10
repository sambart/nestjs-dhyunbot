import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface StatusMappingEntry {
  emoji: string;
  text: string;
}

export interface StatusMapping {
  IN_PROGRESS: StatusMappingEntry;
  COMPLETED: StatusMappingEntry;
  FAILED: StatusMappingEntry;
  LEFT: StatusMappingEntry;
}

@Entity({ schema: 'public' })
@Index('UQ_newbie_mission_template_guild', ['guildId'], { unique: true })
export class NewbieMissionTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ nullable: true })
  titleTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  headerTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  itemTemplate: string | null;

  @Column({ nullable: true })
  footerTemplate: string | null;

  @Column({ type: 'json', nullable: true })
  statusMapping: StatusMapping | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
