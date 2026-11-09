import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OptionalText, TrimText } from '../../public/submission.js';

export const PRAYER_CONTENT_MAX_LENGTH = 2000;

export class CreatePrayerRequestDto {
  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // Required when wantsFollowUp is true; still length-checked when sent otherwise
  @OptionalText()
  @ValidateIf(
    (o: CreatePrayerRequestDto) =>
      o.wantsFollowUp === true || (o.contact !== undefined && o.contact !== null),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contact?: string;

  @IsOptional()
  @IsBoolean()
  wantsFollowUp?: boolean;

  @TrimText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRAYER_CONTENT_MAX_LENGTH)
  content!: string;

  @IsBoolean()
  @Equals(true, { message: 'consent must be true' })
  consent!: boolean;

  // Honeypot. Declared so the whitelist keeps it; any value is accepted here.
  @IsOptional()
  website?: unknown;
}
