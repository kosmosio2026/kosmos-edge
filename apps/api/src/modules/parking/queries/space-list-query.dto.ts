import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SpaceStatus } from '@parking/db';

export class SpaceListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;
}
