import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SectionListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  parkingLotId?: string;
}
