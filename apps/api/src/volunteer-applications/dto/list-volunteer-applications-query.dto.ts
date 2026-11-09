import { IsEnum, ValidateIf } from 'class-validator';
import { VolunteerApplicationStatus } from '../entities/volunteer-application.entity.js';

export class ListVolunteerApplicationsQueryDto {
  // Empty or repeated values are 400
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(VolunteerApplicationStatus)
  status?: VolunteerApplicationStatus;
}
