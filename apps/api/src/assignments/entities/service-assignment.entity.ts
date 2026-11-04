import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Service } from '../../services/entities/service.entity.js';
import { Team } from '../../teams/entities/team.entity.js';
import { User } from '../../users/entities/user.entity.js';

// One person can be assigned to a service by only one team. The database
// enforces it, so assigning must use INSERT ... ON CONFLICT, never check-then-insert.
@Entity({ name: 'service_assignments' })
@Unique('service_assignments_service_user_key', ['serviceId', 'userId'])
@Index('service_assignments_one_taker_idx', ['serviceId', 'teamId'], {
  unique: true,
  where: '"is_absent_taker"',
})
export class ServiceAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'assigned_by', type: 'uuid' })
  assignedBy: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  // At most one per (service, team): enforced by the partial unique index
  @Column({ name: 'is_absent_taker', type: 'boolean', default: false })
  isAbsentTaker: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'service_id' })
  service: Relation<Service>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'team_id' })
  team: Relation<Team>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'assigned_by' })
  assigner: Relation<User>;
}
