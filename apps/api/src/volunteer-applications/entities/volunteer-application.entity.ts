import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum VolunteerApplicationStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

// Submitted from the public site. status, admin_note, handled_by and handled_at
// are for the admin side (feature B2); they are never shown publicly.
@Entity({ name: 'volunteer_applications' })
export class VolunteerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'whatsapp', type: 'varchar', length: 30 })
  whatsapp: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'availability', type: 'varchar', length: 500, nullable: true })
  availability: string | null;

  @Column({ name: 'message', type: 'varchar', length: 1000, nullable: true })
  message: string | null;

  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: VolunteerApplicationStatus,
    enumName: 'volunteer_application_status',
    default: VolunteerApplicationStatus.NEW,
  })
  status: VolunteerApplicationStatus;

  @Column({ name: 'admin_note', type: 'varchar', length: 1000, nullable: true })
  adminNote: string | null;

  @Column({ name: 'handled_by', type: 'uuid', nullable: true })
  handledBy: string | null;

  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Deleting the user keeps the application, with handled_by cleared
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'handled_by' })
  handler: Relation<User> | null;
}
