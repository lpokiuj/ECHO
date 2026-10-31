import { IsBoolean, IsOptional } from 'class-validator';

export class SetMemberDto {
  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;
}
