import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../teams/entities/team.entity.js';
import { PublicBidangController } from './public-bidang.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Team])],
  controllers: [PublicBidangController],
})
export class PublicModule {}
