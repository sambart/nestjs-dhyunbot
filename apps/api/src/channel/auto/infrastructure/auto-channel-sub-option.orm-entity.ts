import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { AutoChannelButtonOrm } from './auto-channel-button.orm-entity';

@Entity({ name: 'auto_channel_sub_option', schema: 'public' })
@Index('IDX_auto_channel_sub_option_button', ['buttonId'])
export class AutoChannelSubOptionOrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  buttonId: number;

  @ManyToOne(() => AutoChannelButtonOrm, (button) => button.subOptions, {
    onDelete: 'CASCADE',
  })
  button: AutoChannelButtonOrm;

  @Column()
  label: string;

  @Column({ type: 'varchar', nullable: true })
  emoji: string | null;

  @Column()
  channelNameTemplate: string;

  @Column({ default: 0 })
  sortOrder: number;
}
