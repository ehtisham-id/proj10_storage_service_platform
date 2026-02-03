import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const cookie = client.handshake.headers.cookie;
    
    const token = cookie?.match(/auth-token=([^;]+)/)?.[1];
    if (!token) throw new WsException('No token provided');

    try {
      const payload = this.jwtService.verify(token);
      client.user = payload;
      return true;
    } catch {
      throw new WsException('Invalid token');
    }
  }
}
