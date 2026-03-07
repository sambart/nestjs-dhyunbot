import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AutoChannelConfig } from './auto-channel-config.entity';
import { AutoChannelSubOption } from './auto-channel-sub-option.entity';

@Entity({ schema: 'public' })
@Index('IDX_auto_channel_button_config', ['configId'])
export class AutoChannelButton {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  configId: number;

  @ManyToOne(() => AutoChannelConfig, (config) => config.buttons, {
    onDelete: 'CASCADE',
  })
  config: AutoChannelConfig;

  @Column()
  label: string;

  @Column({ nullable: true })
  emoji: string | null;

  @Column()
  targetCategoryId: string;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => AutoChannelSubOption, (option) => option.button, {
    cascade: true,
  })
  subOptions: AutoChannelSubOption[];
}
