import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AutoChannelButtonOrm } from './auto-channel-button.orm-entity';

@Entity({ name: 'auto_channel_config', schema: 'public' })
@Index('UQ_auto_channel_config_guild_trigger', ['guildId', 'triggerChannelId'], {
  unique: true,
})
export class AutoChannelConfigOrm {
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

  @OneToMany(() => AutoChannelButtonOrm, (button) => button.config, {
    cascade: true,
  })
  buttons: AutoChannelButtonOrm[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
