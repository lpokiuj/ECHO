import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../auth/decorators/public.js';
import { Team } from '../teams/entities/team.entity.js';

@Controller('public/bidang')
export class PublicBidangController {
  constructor(@InjectRepository(Team) private readonly teams: Repository<Team>) {}

  // Only id and name, mapped explicitly so no future Team column can leak
  @Public()
  @Get()
  async list(): Promise<{ id: string; name: string }[]> {
    const rows = await this.teams.find({
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
    return rows.map((t) => ({ id: t.id, name: t.name }));
  }
}
