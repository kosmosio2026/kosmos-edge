import { ScopeType } from '@parking/db';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RoleMenuPolicyItemDto {
  @IsString()
  menuCode!: string;

  @IsBoolean()
  canView!: boolean;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;
}

export class UpdateRoleMenuPoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleMenuPolicyItemDto)
  items!: RoleMenuPolicyItemDto[];
}