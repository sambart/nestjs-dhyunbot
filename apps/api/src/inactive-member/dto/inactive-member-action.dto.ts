import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';

export class InactiveMemberActionDto {
  @IsIn(['ACTION_DM', 'ACTION_ROLE_ADD', 'ACTION_ROLE_REMOVE', 'ACTION_KICK'])
  actionType: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  targetUserIds: string[];
}
