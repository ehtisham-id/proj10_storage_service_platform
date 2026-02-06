import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { graphqlUploadExpress } from 'graphql-upload-minimal';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import * as net from 'net';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Wait for Kafka broker to be reachable to avoid "group coordinator" errors
  async function waitForKafka(
    broker = process.env.KAFKA_BROKERS || 'kafka:29092',
    retries = 10,
    delay = 2000,
  ) {
    const [host, portStr] = broker.split(':');
    const port = Number(portStr) || 29092;

    for (let i = 0; i < retries; i++) {
      const ok = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1500);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, host);
      });

      if (ok) return;
      // wait and retry
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, delay));
    }

    // continue anyway; Kafka client will keep retrying, but GroupCoordinator errors may appear
    console.warn(
      `Kafka broker ${broker} not reachable after ${retries} attempts`,
    );
  }

  app.use(graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 1 }));

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5500'],
    credentials: true,
  });

  await waitForKafka();
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
