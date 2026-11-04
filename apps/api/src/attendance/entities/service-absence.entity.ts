import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ServiceAssignment } from '../../assignments/entities/service-assignment.entity.js';
import { User } from '../../users/entities/user.entity.js';

// A recorded absence. The miss counter is COUNT(*) over these rows, never stored.
// The composite FK to the assignment row means an assignment with a recorded
// absence cannot be deleted (unassign and member removal answer 409).
@Entity({ name: 'service_absences' })
export class ServiceAbsence {
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ServiceAssignment, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    { name: 'service_id', referencedColumnName: 'serviceId' },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  assignment: Relation<ServiceAssignment>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'recorded_by' })
  recorder: Relation<User>;
}
