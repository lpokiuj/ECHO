import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OptionalText, TrimText } from '../../public/submission.js';

export const MAX_BIDANG_IDS = 20;

export class CreateVolunteerApplicationDto {
  @TrimText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @TrimText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  whatsapp!: string;

  @OptionalText()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BIDANG_IDS)
  @IsUUID('all', { each: true })
  bidangIds?: string[];

  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  availability?: string;

  @OptionalText()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsBoolean()
  @Equals(true, { message: 'consent must be true' })
  consent!: boolean;

  // Honeypot. Declared so the whitelist keeps it; any value is accepted here.
  @IsOptional()
  website?: unknown;
}
