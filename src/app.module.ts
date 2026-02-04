import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { PrismaModule } from './prisma/prisma.module';
import { MinioModule } from './minio/minio.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { KafkaModule } from './kafka/kafka.module';
import { EventsModule } from './events/events.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: async () => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        playground: true,
        installSubscriptionHandlers: true,
        context: ({ req, pubsub }) => ({ req, pubsub }),
      }),
    }),
    ThrottlerModule,
    PubSubModule,
    PrismaModule,
    AuthModule,
    FilesModule,
    MinioModule,
    KafkaModule,
    EventsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
