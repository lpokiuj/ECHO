import { IsString, MaxLength } from 'class-validator';
import { NOTES_MAX_LENGTH } from './assign.dto.js';

export class UpdateNotesDto {
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  notes: string;
}
