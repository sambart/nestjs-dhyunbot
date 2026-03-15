import { IsObject, IsOptional, IsString } from 'class-validator';

import { StatusMapping } from '../../domain/newbie-mission-template.entity';

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
