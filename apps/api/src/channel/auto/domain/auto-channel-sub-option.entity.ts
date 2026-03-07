import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AutoChannelButton } from './auto-channel-button.entity';

@Entity({ schema: 'public' })
@Index('IDX_auto_channel_sub_option_button', ['buttonId'])
export class AutoChannelSubOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  buttonId: number;

  @ManyToOne(() => AutoChannelButton, (button) => button.subOptions, {
    onDelete: 'CASCADE',
  })
  button: AutoChannelButton;

  @Column()
  label: string;

  @Column({ nullable: true })
  emoji: string | null;

  @Column()
  channelNameTemplate: string;

  @Column({ default: 0 })
  sortOrder: number;
}
