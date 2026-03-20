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

  @Column({ type: 'varchar', nullable: true })
  guideChannelId: string | null;

  @Column({ type: 'varchar', nullable: true })
  waitingRoomTemplate: string | null;

  @Column({ type: 'text' })
  guideMessage: string;

  @Column({ type: 'varchar', nullable: true })
  embedTitle: string | null;

  @Column({ type: 'varchar', nullable: true })
  embedColor: string | null;

  @Column({ type: 'varchar', nullable: true })
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
