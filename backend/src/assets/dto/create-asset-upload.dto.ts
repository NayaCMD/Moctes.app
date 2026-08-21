import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const assetTypes = ['image', 'sticker', 'post-it', 'tape'] as const;
export const assetMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;
export const MAX_ASSET_SIZE = 5 * 1024 * 1024;

export class CreateAssetUploadDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Length(1, 255)
  originalFilename!: string;

  @IsIn(assetTypes)
  type!: (typeof assetTypes)[number];

  @IsMimeType()
  @IsIn(assetMimeTypes)
  mimeType!: (typeof assetMimeTypes)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ASSET_SIZE)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  folderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000)
  height?: number;
}
