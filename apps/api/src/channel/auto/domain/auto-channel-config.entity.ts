import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AutoChannelButton } from './auto-channel-button.entity';

@Entity({ schema: 'public' })
@Index('UQ_auto_channel_config_guild_trigger', ['guildId', 'triggerChannelId'], {
  unique: true,
})
export class AutoChannelConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column()
  triggerChannelId: string;

  @Column()
  waitingRoomTemplate: string;

  @Column({ type: 'text' })
  guideMessage: string;

  @Column({ nullable: true })
  guideMessageId: string | null;

  @OneToMany(() => AutoChannelButton, (button) => button.config, {
    cascade: true,
  })
  buttons: AutoChannelButton[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
