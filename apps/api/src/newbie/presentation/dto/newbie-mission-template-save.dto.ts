import { IsObject, IsOptional, IsString } from 'class-validator';

import { type StatusMapping } from '../../domain/newbie-mission.types';

export class NewbieMissionTemplateSaveDto {
  @IsOptional()
  @IsString()
  titleTemplate?: string | null;

  @IsOptional()
  @IsString()
  headerTemplate?: string | null;

  @IsOptional()
  @IsString()
  itemTemplate?: string | null;

  @IsOptional()
  @IsString()
  footerTemplate?: string | null;

  @IsOptional()
  @IsObject()
  statusMapping?: StatusMapping | null;
}
