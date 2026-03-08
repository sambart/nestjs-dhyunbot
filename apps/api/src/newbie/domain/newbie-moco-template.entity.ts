import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'public' })
@Index('UQ_newbie_moco_template_guild', ['guildId'], { unique: true })
export class NewbieMocoTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  guildId: string;

  @Column({ nullable: true })
  titleTemplate: string | null;

  @Column({ type: 'text', nullable: true })
  bodyTemplate: string | null;

  @Column({ nullable: true })
  itemTemplate: string | null;

  @Column({ nullable: true })
  footerTemplate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
