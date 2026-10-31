import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { HAS_OFFSET, trim } from './create-service.dto.js';

export class UpdateServiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(HAS_OFFSET, {
    message: 'startsAt must include a timezone offset (Z or +HH:MM)',
  })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(HAS_OFFSET, {
    message: 'endsAt must include a timezone offset (Z or +HH:MM)',
  })
  endsAt?: string;
}
