import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_privacy_config', schema: 'public' })
@Index('IDX_user_privacy_config_user', ['userId'])
export class UserPrivacyConfigOrm {
  @PrimaryColumn({ type: 'varchar' })
  guildId: string;

  @PrimaryColumn({ type: 'varchar' })
  userId: string;

  @Column({ type: 'boolean', default: false })
  disableRelationshipShare: boolean;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
