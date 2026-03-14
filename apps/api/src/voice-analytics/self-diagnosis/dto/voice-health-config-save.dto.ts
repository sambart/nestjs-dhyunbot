import { IsBoolean, IsInt, IsNumber, Max, Min } from 'class-validator';

export class VoiceHealthConfigSaveDto {
  @IsBoolean()
  isEnabled: boolean;

  @IsInt()
  @Min(7)
  @Max(90)
  analysisDays: number;

  @IsBoolean()
  isCooldownEnabled: boolean;

  @IsInt()
  @Min(1)
  @Max(168)
  cooldownHours: number;

  @IsBoolean()
  isLlmSummaryEnabled: boolean;

  @IsInt()
  @Min(0)
  minActivityMinutes: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  minActiveDaysRatio: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  hhiThreshold: number;

  @IsInt()
  @Min(1)
  minPeerCount: number;

  @IsInt()
  @Min(1)
  @Max(100)
  badgeActivityTopPercent: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  badgeSocialHhiMax: number;

  @IsInt()
  @Min(1)
  badgeSocialMinPeers: number;

  @IsInt()
  @Min(1)
  @Max(100)
  badgeHunterTopPercent: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  badgeConsistentMinRatio: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  badgeMicMinRate: number;
}
