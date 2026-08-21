import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsIn(['notebook', 'notepad', 'clipboard'])
  type!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @IsObject()
  document!: Record<string, unknown>;
}
