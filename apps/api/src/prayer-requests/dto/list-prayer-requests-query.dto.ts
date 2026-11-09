import { IsEnum, ValidateIf } from 'class-validator';
import { PrayerRequestStatus } from '../entities/prayer-request.entity.js';

export class ListPrayerRequestsQueryDto {
  // Empty or repeated values are 400
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(PrayerRequestStatus)
  status?: PrayerRequestStatus;
}
