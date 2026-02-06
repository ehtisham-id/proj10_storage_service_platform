import { Module } from '@nestjs/common';
import { FilesResolver } from './files.resolver';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [PrismaModule, MinioModule, PubSubModule, KafkaModule],
  controllers: [FilesController],
  providers: [FilesService, FilesResolver],
  exports: [FilesService],
})
export class FilesModule {}
