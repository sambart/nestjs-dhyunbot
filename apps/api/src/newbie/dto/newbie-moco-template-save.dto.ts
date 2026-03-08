import { IsOptional, IsString } from 'class-validator';

export class NewbieMocoTemplateSaveDto {
  @IsOptional()
  @IsString()
  titleTemplate?: string | null;

  @IsOptional()
  @IsString()
  bodyTemplate?: string | null;

  @IsOptional()
  @IsString()
  itemTemplate?: string | null;

  @IsOptional()
  @IsString()
  footerTemplate?: string | null;
}
