export enum InactiveMemberGrade {
  FULLY_INACTIVE = 'FULLY_INACTIVE',
  LOW_ACTIVE = 'LOW_ACTIVE',
  DECLINING = 'DECLINING',
}

export enum InactiveMemberActionType {
  ACTION_DM = 'ACTION_DM',
  ACTION_ROLE_ADD = 'ACTION_ROLE_ADD',
  ACTION_ROLE_REMOVE = 'ACTION_ROLE_REMOVE',
  ACTION_KICK = 'ACTION_KICK',
}

export interface InactiveMemberClassifyParams {
  lowActiveThresholdMin: number;
  decliningPercent: number;
}
