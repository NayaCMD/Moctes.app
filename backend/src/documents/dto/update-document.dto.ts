import { Type } from 'class-transformer';
import { IsInt, IsObject, Min } from 'class-validator';

export class UpdateDocumentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCollaborationSequence!: number;

  @IsObject()
  document!: Record<string, unknown>;
}
