import { type JwtService } from '@nestjs/jwt';
import { type Mocked, vi } from 'vitest';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: Mocked<JwtService>;

  beforeEach(() => {
    jwtService = {
      sign: vi.fn().mockReturnValue('signed-token'),
    } as unknown as Mocked<JwtService>;

    service = new AuthService(jwtService);
  });

  describe('createToken', () => {
    it('관리 권한(ADMINISTRATOR)이 있는 길드만 포함하여 토큰을 생성한다', () => {
      const result = service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        avatar: 'avatar-hash',
        guilds: [
          { id: 'g1', name: 'Admin Guild', icon: 'icon1', owner: false, permissions: 0x8 },
          { id: 'g2', name: 'No Perm Guild', icon: null, owner: false, permissions: 0 },
        ],
      });

      expect(result).toBe('signed-token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'TestUser',
        avatar: 'avatar-hash',
        guilds: [{ id: 'g1', name: 'Admin Guild', icon: 'icon1' }],
      });
    });

    it('MANAGE_GUILD 권한이 있는 길드를 포함한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        guilds: [{ id: 'g1', name: 'Manage Guild', icon: null, owner: false, permissions: 0x20 }],
      });

      const payload = jwtService.sign.mock.calls[0]![0] as { guilds: Array<{ id: string }> };
      expect(payload.guilds).toHaveLength(1);
      expect(payload.guilds[0]!.id).toBe('g1');
    });

    it('owner인 길드를 포함한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        guilds: [{ id: 'g1', name: 'Owner Guild', icon: null, owner: true, permissions: 0 }],
      });

      const payload = jwtService.sign.mock.calls[0]![0] as { guilds: Array<{ id: string }> };
      expect(payload.guilds).toHaveLength(1);
    });

    it('ADMINISTRATOR + MANAGE_GUILD 복합 권한도 필터링한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        guilds: [{ id: 'g1', name: 'Both', icon: null, owner: false, permissions: 0x8 | 0x20 }],
      });

      const payload = jwtService.sign.mock.calls[0]![0] as { guilds: Array<{ id: string }> };
      expect(payload.guilds).toHaveLength(1);
    });

    it('권한이 없는 길드는 제외한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        guilds: [
          { id: 'g1', name: 'No Perm', icon: null, owner: false, permissions: 0x1 },
          { id: 'g2', name: 'Also No Perm', icon: null, owner: false, permissions: 0x10 },
        ],
      });

      const payload = jwtService.sign.mock.calls[0]![0] as { guilds: Array<{ id: string }> };
      expect(payload.guilds).toEqual([]);
    });

    it('guilds가 없으면 빈 배열로 처리한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
      });

      const payload = jwtService.sign.mock.calls[0]![0] as { guilds: Array<{ id: string }> };
      expect(payload.guilds).toEqual([]);
    });

    it('페이로드에서 permissions 필드를 제거한다', () => {
      service.createToken({
        discordId: 'user-1',
        username: 'TestUser',
        guilds: [{ id: 'g1', name: 'Admin', icon: null, owner: true, permissions: 0x8 }],
      });

      const payload = jwtService.sign.mock.calls[0]![0] as {
        guilds: Array<Record<string, unknown>>;
      };
      expect(payload.guilds[0]).toEqual({ id: 'g1', name: 'Admin', icon: null });
      expect(payload.guilds[0]).not.toHaveProperty('permissions');
      expect(payload.guilds[0]).not.toHaveProperty('owner');
    });
  });
});
