import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Prisma v5's library engine no longer supports the $on('beforeExit') hook.
    // Attach shutdown hooks to the process object instead so Nest can close gracefully.
    const shutdown = async () => {
      try {
        await app.close();
      } catch (e) {
        // ignore errors during shutdown
      }
    };

    process.once('beforeExit', async () => {
      await shutdown();
    });

    process.once('SIGINT', async () => {
      await shutdown();
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      await shutdown();
      process.exit(0);
    });
  }
}
