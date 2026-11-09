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

export enum PrayerRequestStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

// Submitted from the public site. status, admin_note, handled_by and handled_at
// are for the admin side (feature B2); they are never shown publicly.
@Entity({ name: 'prayer_requests' })
export class PrayerRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ name: 'contact', type: 'varchar', length: 100, nullable: true })
  contact: string | null;

  @Column({ name: 'wants_follow_up', type: 'boolean', default: false })
  wantsFollowUp: boolean;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'consent_at', type: 'timestamptz' })
  consentAt: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PrayerRequestStatus,
    enumName: 'prayer_request_status',
    default: PrayerRequestStatus.NEW,
  })
  status: PrayerRequestStatus;

  @Column({ name: 'admin_note', type: 'varchar', length: 1000, nullable: true })
  adminNote: string | null;

  @Column({ name: 'handled_by', type: 'uuid', nullable: true })
  handledBy: string | null;

  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Deleting the user keeps the submission, with handled_by cleared
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'handled_by' })
  handler: Relation<User> | null;
}
