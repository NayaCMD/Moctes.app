import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RestoreDocumentRevisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedCollaborationSequence!: number;
}
