/** Discord 멤버 정보 조회를 추상화하는 포트. Bot/API 분리 시 HTTP 구현체로 교체 가능. */
export interface MocoMemberResolver {
  /**
   * 채널의 멤버 중 신입(모코코) ID 목록을 반환한다.
   * @param cutoffMs joinedAt >= cutoffMs 인 멤버만 신입으로 판정
   */
  getNewbieIds(
    guildId: string,
    channelId: string,
    userIds: string[],
    cutoffMs: number,
  ): Promise<string[]>;

  /**
   * 사냥꾼 자격을 확인한다.
   * @returns null이면 사냥꾼 자격 없음 (봇이거나 존재하지 않음)
   */
  isValidHunter(
    guildId: string,
    hunterId: string,
    cutoffMs: number,
    allowNewbie: boolean,
  ): Promise<boolean>;

  /**
   * peerIds 중 신입(모코코) ID 목록을 반환한다.
   */
  getNewbiePeerIds(
    guildId: string,
    peerIds: string[],
    cutoffMs: number,
  ): Promise<string[]>;
}

export const MOCO_MEMBER_RESOLVER = Symbol('MOCO_MEMBER_RESOLVER');
