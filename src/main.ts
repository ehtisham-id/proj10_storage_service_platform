import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { graphqlUploadExpress } from 'graphql-upload';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 1 }));
  
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5500'],
    credentials: true
  });

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'kafka:29092'],
      },
      consumer: {
        groupId: process.env.KAFKA_CONSUMER_GROUP || 'storage-consumer',
      },
    },
  });

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  await app.startAllMicroservices();
  
  await app.listen(3000);
}
bootstrap();
