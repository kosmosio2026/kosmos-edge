import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantCouponProductDto } from './create-tenant-coupon-product.dto';

export class UpdateTenantCouponProductDto extends PartialType(
  CreateTenantCouponProductDto,
) {}
