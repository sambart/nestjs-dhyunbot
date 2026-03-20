import { type Repository } from 'typeorm';
import { type Mocked, vi } from 'vitest';

import { type MemberOrmEntity as Member } from './infrastructure/member.orm-entity';
import { MemberService } from './member.service';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 1,
    discordMemberId: 'user-1',
    nickname: '테스트유저',
    avatarUrl: null,
    voiceHistories: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Member;
}

describe('MemberService', () => {
  let service: MemberService;
  let repo: Mocked<Repository<Member>>;

  beforeEach(() => {
    repo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    } as unknown as Mocked<Repository<Member>>;

    service = new MemberService(repo);
  });

  describe('findOne', () => {
    it('discordMemberId로 멤버를 조회한다', async () => {
      const member = makeMember();
      repo.findOne.mockResolvedValue(member);

      const result = await service.findOne('user-1');

      expect(result).toBe(member);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { discordMemberId: 'user-1' },
      });
    });

    it('존재하지 않는 멤버는 null을 반환한다', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findOne('unknown');

      expect(result).toBeNull();
    });
  });

  describe('findOrCreateMember', () => {
    it('신규 멤버를 생성한다', async () => {
      const created = makeMember({ discordMemberId: 'new-user', nickname: '신규유저' });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.findOrCreateMember('new-user', '신규유저', 'https://avatar.url');

      expect(repo.create).toHaveBeenCalledWith({
        discordMemberId: 'new-user',
        nickname: '신규유저',
        avatarUrl: 'https://avatar.url',
      });
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('닉네임이 빈 문자열이면 unknown으로 생성한다', async () => {
      const created = makeMember({ nickname: 'unknown' });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.findOrCreateMember('user-1', '');

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'unknown' }));
    });

    it('avatarUrl이 null이면 null로 저장한다', async () => {
      const created = makeMember();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.findOrCreateMember('user-1', '테스트', null);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }));
    });

    it('기존 멤버의 닉네임이 변경되면 업데이트한다', async () => {
      const existing = makeMember({ nickname: '이전닉네임' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, nickname: '새닉네임' } as Member);

      const result = await service.findOrCreateMember('user-1', '새닉네임');

      expect(existing.nickname).toBe('새닉네임');
      expect(repo.save).toHaveBeenCalledWith(existing);
      expect(result.nickname).toBe('새닉네임');
    });

    it('기존 멤버의 아바타가 변경되면 업데이트한다', async () => {
      const existing = makeMember({ avatarUrl: 'old-url' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, avatarUrl: 'new-url' } as Member);

      await service.findOrCreateMember('user-1', '테스트유저', 'new-url');

      expect(existing.avatarUrl).toBe('new-url');
      expect(repo.save).toHaveBeenCalled();
    });

    it('닉네임과 아바타 모두 변경이 없으면 save를 호출하지 않는다', async () => {
      const existing = makeMember({ nickname: '동일닉네임', avatarUrl: 'same-url' });
      repo.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreateMember('user-1', '동일닉네임', 'same-url');

      expect(repo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('기존 멤버에 닉네임이 falsy면 업데이트하지 않는다', async () => {
      const existing = makeMember({ nickname: '기존닉네임' });
      repo.findOne.mockResolvedValue(existing);

      await service.findOrCreateMember('user-1', '');

      expect(existing.nickname).toBe('기존닉네임');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('기존 멤버에 avatarUrl이 falsy면 업데이트하지 않는다', async () => {
      const existing = makeMember({ avatarUrl: 'existing-url' });
      repo.findOne.mockResolvedValue(existing);

      await service.findOrCreateMember('user-1', '테스트유저', null);

      expect(existing.avatarUrl).toBe('existing-url');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
