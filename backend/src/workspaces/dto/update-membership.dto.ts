import { MembershipStatus, WorkspaceRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
