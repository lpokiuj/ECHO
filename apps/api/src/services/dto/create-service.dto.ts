import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Length, Matches } from 'class-validator';

// Requires an explicit offset: "Z" or "+07:00" (a value without a timezone is rejected)
export const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const OFFSET_MESSAGE = 'must include a timezone offset (Z or +HH:MM)';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateServiceDto {
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title: string;

  @IsISO8601({ strict: true })
  @Matches(HAS_OFFSET, { message: `startsAt ${OFFSET_MESSAGE}` })
  startsAt: string;

  @IsISO8601({ strict: true })
  @Matches(HAS_OFFSET, { message: `endsAt ${OFFSET_MESSAGE}` })
  endsAt: string;
}
