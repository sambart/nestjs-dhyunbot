import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { StatusPrefixConfig } from './status-prefix-config.entity';

export enum StatusPrefixButtonType {
  PREFIX = 'PREFIX',
  RESET = 'RESET',
}

@Entity({ schema: 'public' })
@Index('IDX_status_prefix_button_config', ['configId', 'sortOrder'])
export class StatusPrefixButton {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  configId: number;

  @ManyToOne(() => StatusPrefixConfig, (config) => config.buttons, {
    onDelete: 'CASCADE',
  })
  config: StatusPrefixConfig;

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
