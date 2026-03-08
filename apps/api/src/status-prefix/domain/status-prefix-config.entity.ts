import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { StatusPrefixButton } from './status-prefix-button.entity';

@Entity({ schema: 'public' })
@Index('UQ_status_prefix_config_guild', ['guildId'], { unique: true })
export class StatusPrefixConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ nullable: true })
  channelId: string | null;

  @Column({ nullable: true })
  messageId: string | null;

  @Column({ nullable: true })
  embedTitle: string | null;

  @Column({ type: 'text', nullable: true })
  embedDescription: string | null;

  @Column({ nullable: true })
  embedColor: string | null;

  @Column({ default: '[{prefix}] {nickname}' })
  prefixTemplate: string;

  @OneToMany(() => StatusPrefixButton, (button) => button.config, {
    cascade: true,
  })
  buttons: StatusPrefixButton[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
