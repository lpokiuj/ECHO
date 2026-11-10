import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Length, Matches } from 'class-validator';
import { HAS_OFFSET, trim } from '../../services/dto/create-service.dto.js';

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title: string;

  @IsISO8601({ strict: true })
  @Matches(HAS_OFFSET, {
    message: 'startsAt must include a timezone offset (Z or +HH:MM)',
  })
  startsAt: string;

  @Transform(trim)
  @IsString()
  @Length(1, 200)
  location: string;

  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  description: string;
}
