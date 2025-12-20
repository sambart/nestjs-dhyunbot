// auth/auth.controller.ts
import { Controller, Get, UseGuards, Res, Req } from '@nestjs/common/decorators';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth/discord')
export class AuthController {
  private readonly authService: AuthService;

  @Get()
  @UseGuards(AuthGuard('discord'))
  login() {}

  @Get('callback')
  @UseGuards(AuthGuard('discord'))
  callback(@Req() req, @Res() res) {
    // JWT 발급
    const token = this.authService.createToken(req.user);

    res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
  }
}
