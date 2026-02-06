import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { user, fileId } = ctx.getArgs();
    
    if (!user || !fileId) return false;

    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [
          { ownerId: user.sub },
          { permissions: { some: { userId: user.sub } } }
        ]
      }
    });

    return !!file;
  }
}
