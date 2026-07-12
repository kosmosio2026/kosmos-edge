import {
 IsOptional,
 IsString,
 IsInt,
 Min
} from 'class-validator';

import { Type } from 'class-transformer';

export class SpaceListQueryDto {

 @IsOptional()
 @IsString()
 q?: string;

  @IsOptional()
 @IsString()
 search?: string;

 @IsOptional()
 @IsString()
 parkingLotId?: string;

 @IsOptional()
 @IsString()
 sectionId?: string;

 status?: string;

 @IsOptional()
 @Type(() => Number)
 @IsInt()
 @Min(1)
 page?: number=1;

 @IsOptional()
 @Type(() => Number)
 @IsInt()
 @Min(1)
 pageSize?: number=20;

 @IsOptional()
 @IsString()
 sort?: string='code';
}