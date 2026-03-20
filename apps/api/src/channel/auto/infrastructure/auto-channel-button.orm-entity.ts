import { Column, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { AutoChannelConfigOrm } from './auto-channel-config.orm-entity';
import { AutoChannelSubOptionOrm } from './auto-channel-sub-option.orm-entity';

@Entity({ name: 'auto_channel_button', schema: 'public' })
@Index('IDX_auto_channel_button_config', ['configId'])
export class AutoChannelButtonOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  configId: number;

  @ManyToOne(() => AutoChannelConfigOrm, (config) => config.buttons, {
    onDelete: 'CASCADE',
  })
  config: AutoChannelConfigOrm;

  @Column()
  label: string;

  @Column({ type: 'varchar', nullable: true })
  emoji: string | null;

  @Column()
  targetCategoryId: string;

  @Column({ type: 'varchar', nullable: true })
  channelNameTemplate: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => AutoChannelSubOptionOrm, (option) => option.button, {
    cascade: true,
  })
  subOptions: AutoChannelSubOptionOrm[];
}
