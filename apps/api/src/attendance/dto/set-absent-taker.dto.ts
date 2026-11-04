import { IsUUID } from 'class-validator';

export class SetAbsentTakerDto {
  @IsUUID()
  userId: string;
}
