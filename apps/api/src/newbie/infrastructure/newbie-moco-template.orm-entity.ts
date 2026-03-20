import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'newbie_moco_template', schema: 'public' })
@Index('UQ_newbie_moco_template_guild', ['guildId'], { unique: true })
export class NewbieMocoTemplateOrmEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ type: 'varchar', nullable: true })
  titleTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  bodyTemplate: string | null;

  @Column({ type: 'varchar', nullable: true })
  itemTemplate: string | null;

  @Column({ type: 'varchar', nullable: true })
  footerTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  scoringTemplate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
