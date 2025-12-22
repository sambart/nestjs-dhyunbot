// auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  createToken(user: { discordId: string; username: string; avatar?: string }) {
    const payload = {
      sub: user.discordId, // 표준 JWT claim
      username: user.username,
      avatar: user.avatar,
    };

    return this.jwtService.sign(payload);
  }
}
