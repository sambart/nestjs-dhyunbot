export enum MissionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  LEFT = 'LEFT',
}

export interface StatusMappingEntry {
  emoji: string;
  text: string;
}

export interface StatusMapping {
  IN_PROGRESS: StatusMappingEntry;
  COMPLETED: StatusMappingEntry;
  FAILED: StatusMappingEntry;
  LEFT: StatusMappingEntry;
}
