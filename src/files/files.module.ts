import { Module } from '@nestjs/common';
import {  FilesResolver } from './files.resolver';
import { FilesService } from './files.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [PrismaModule, MinioModule],
  providers: [FilesService, FilesResolver],
  exports: [FilesService],
})
export class FilesModule {}
