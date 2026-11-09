import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import {
  AdminNoteText,
  ADMIN_NOTE_MAX_LENGTH,
} from '../../admin-submissions/admin-submission.js';
import { PrayerRequestStatus } from '../entities/prayer-request.entity.js';

export class UpdatePrayerRequestDto {
  // Not sent: skipped. Sent as null or anything else: validated (null is 400).
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(PrayerRequestStatus)
  status?: PrayerRequestStatus;

  // null or blank clears the note
  @AdminNoteText()
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(ADMIN_NOTE_MAX_LENGTH)
  adminNote?: string | null;
}
