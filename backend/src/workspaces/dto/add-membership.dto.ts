import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';

export class AddMembershipDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
