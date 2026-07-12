import { ScopeType } from '@parking/db';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserScopeItemDto {
  @IsEnum(ScopeType)
  scopeType!: ScopeType;

  @IsOptional()
  @IsString()
  parkingLotId?: string;

  @IsOptional()
  @IsString()
  parkingSectionId?: string;

  @IsOptional()
  @IsString()
  parkingSpaceId?: string;
}

export class UpdateUserScopesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserScopeItemDto)
  items!: UserScopeItemDto[];
}