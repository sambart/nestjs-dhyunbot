import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_setting', schema: 'public' })
export class UserSettingOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  discordUserId: string;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  locale: string;

  @Column({ type: 'varchar', length: 40, default: 'Asia/Seoul' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
