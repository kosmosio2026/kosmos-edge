import { ScopeType } from '@parking/db';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RolePagePolicyItemDto {
  @IsString()
  pageCode!: string;

  @IsBoolean()
  canView!: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;
}

export class UpdateRolePagePoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePagePolicyItemDto)
  items!: RolePagePolicyItemDto[];
}