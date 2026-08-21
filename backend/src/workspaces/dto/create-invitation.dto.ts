import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
