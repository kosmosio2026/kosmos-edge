import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewApprovalRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewedNote?: string;
}