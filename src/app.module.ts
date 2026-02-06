import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { PubSub } from 'graphql-subscriptions';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { PrismaModule } from './prisma/prisma.module';
import { MinioModule } from './minio/minio.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { KafkaModule } from './kafka/kafka.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [PubSub],
      useFactory: async (pubsub: PubSub) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        playground: true,
        uploads: false,
        subscriptions: {
          'graphql-ws': true,
        },
        context: ({ req, extra }) => ({
          req: req ?? extra?.request,
          pubsub,
        }),
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
  providers: [],
})
export class AppModule {}
