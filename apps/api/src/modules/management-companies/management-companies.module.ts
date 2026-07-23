import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManagementCompaniesController } from './management-companies.controller';
import { ManagementCompaniesService } from './management-companies.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManagementCompaniesController],
  providers: [ManagementCompaniesService],
})
export class ManagementCompaniesModule {}
