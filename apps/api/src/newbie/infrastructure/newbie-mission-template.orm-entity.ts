import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { StatusMapping } from '../domain/newbie-mission.types';

@Entity({ name: 'newbie_mission_template', schema: 'public' })
@Index('UQ_newbie_mission_template_guild', ['guildId'], { unique: true })
export class NewbieMissionTemplateOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ type: 'varchar', nullable: true })
  titleTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  headerTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  itemTemplate: string | null;

  @Column({ type: 'varchar', nullable: true })
  footerTemplate: string | null;

  @Column({ type: 'json', nullable: true })
  statusMapping: StatusMapping | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
