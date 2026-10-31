import { IsIn, IsOptional } from 'class-validator';

export class ScheduleQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'includePast must be true or false',
  })
  includePast?: string;
}
