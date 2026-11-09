import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SubmissionCounts {
  prayerRequestsNew: number;
  volunteerApplicationsNew: number;
}

@Injectable()
export class AdminSubmissionsService {
  constructor(private readonly dataSource: DataSource) {}

  // One query; count() is a bigint, which the driver returns as a string
  async counts(): Promise<SubmissionCounts> {
    const [row]: { prayer: string; volunteer: string }[] =
      await this.dataSource.query(
        `SELECT
           (SELECT count(*) FROM prayer_requests WHERE status = 'NEW') AS prayer,
           (SELECT count(*) FROM volunteer_applications WHERE status = 'NEW') AS volunteer`,
      );
    return {
      prayerRequestsNew: Number(row.prayer),
      volunteerApplicationsNew: Number(row.volunteer),
    };
  }
}
