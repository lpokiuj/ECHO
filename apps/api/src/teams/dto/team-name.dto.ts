import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TeamNameDto {
  // Validated on the trimmed value. The handler still gets the raw body
  // (ValidationPipe has no transform: true), so the service trims again.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
