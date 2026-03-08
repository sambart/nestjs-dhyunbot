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
  name: string;

  @Column()
  triggerChannelId: string;

  @Column({ nullable: true })
  guideChannelId: string | null;

  @Column({ nullable: true })
  waitingRoomTemplate: string | null;

  @Column({ type: 'text' })
  guideMessage: string;

  @Column({ nullable: true })
  embedTitle: string | null;

  @Column({ nullable: true })
  embedColor: string | null;

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
