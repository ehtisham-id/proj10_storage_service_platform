import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        ttl: 60,
        limit: 10, // 10 req/min per IP
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlerModule {}
