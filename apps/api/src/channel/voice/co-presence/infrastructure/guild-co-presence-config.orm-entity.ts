import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'guild_co_presence_config', schema: 'public' })
export class GuildCoPresenceConfigOrm {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @Column({ type: 'boolean', default: false })
  allowPublicAffinityQuery: boolean;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
