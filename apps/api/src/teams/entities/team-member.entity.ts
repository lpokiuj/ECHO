import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Team } from './team.entity.js';

@Entity({ name: 'team_members' })
export class TeamMember {
  @PrimaryColumn({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'is_leader', type: 'boolean', default: false })
  isLeader: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Team, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'team_id' })
  team: Relation<Team>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
