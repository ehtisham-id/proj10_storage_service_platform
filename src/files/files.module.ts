import { Module } from '@nestjs/common';
import { FilesService, FilesResolver, FilesService } from './';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [PrismaModule, MinioModule],
  providers: [FilesService, FilesResolver],
  exports: [FilesService],
})
export class FilesModule {}
