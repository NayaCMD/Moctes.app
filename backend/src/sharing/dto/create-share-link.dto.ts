import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateShareLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
