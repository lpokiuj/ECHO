import { Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Team } from '../../teams/entities/team.entity.js';
import { VolunteerApplication } from './volunteer-application.entity.js';

// Which bidang (teams) an applicant is interested in (0..n). Both FKs cascade:
// deleting the application removes its interests, and deleting a team (DELETE
// /teams/:id) must never be blocked by them, so only that team's interest row goes.
@Entity({ name: 'volunteer_application_bidang' })
export class VolunteerApplicationBidang {
  @PrimaryColumn({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @PrimaryColumn({ name: 'bidang_id', type: 'uuid' })
  bidangId: string;

  @ManyToOne(() => VolunteerApplication, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'application_id' })
  application: Relation<VolunteerApplication>;

  @ManyToOne(() => Team, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'bidang_id' })
  bidang: Relation<Team>;
}
