import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { StatusPrefixButtonType } from '../domain/status-prefix.types';
import { StatusPrefixConfigOrm } from './status-prefix-config.orm-entity';

@Entity({ name: 'status_prefix_button', schema: 'public' })
@Index('IDX_status_prefix_button_config', ['configId', 'sortOrder'])
export class StatusPrefixButtonOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  configId: number;

  @ManyToOne(() => StatusPrefixConfigOrm, (config) => config.buttons, {
    onDelete: 'CASCADE',
  })
  config: StatusPrefixConfigOrm;

  @Column()
  label: string;

  @Column({ nullable: true })
  emoji: string | null;

  @Column({ nullable: true })
  prefix: string | null;

  @Column({ type: 'enum', enum: StatusPrefixButtonType })
  type: StatusPrefixButtonType;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
