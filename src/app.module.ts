import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GatewayIntentBit } from '@nestjs/websockets';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { PrismaModule } from './prisma/prisma.module';
import { MinioModule } from './minio/minio.module';
import { PubSubModule } from './pubsub/pubsub.module';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      installSubscriptionHandlers: true,
      context: ({ req, pubsub }) => ({ req, pubsub }),
    }),
    PubSubModule,
    PrismaModule,
    AuthModule,
    FilesModule,
    MinioModule,
  ],
})
export class AppModule {}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({ /* ... */ }),
    ThrottlerModule,
    PubSubModule,
    PrismaModule,
    AuthModule,
    FilesModule,
    MinioModule,
  ],
})
export class AppModule {}

 KafkaModule,      // ✅ Added
    EventsModule,  