import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  async getFiles(userId: string) {
    return this.prisma.file.findMany({
      where: {
        OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
      },
      include: {
        owner: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1, // Latest version only
        },
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFile(id: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
      },
      include: {
        owner: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        permissions: {
          include: { user: true },
        },
      },
    });

    if (!file) throw new NotFoundException('File not found or access denied');
    return file;
  }

  async getFileVersions(fileId: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
      },
    });

    if (!file) throw new NotFoundException('File not found or access denied');

    return this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async uploadFile(file: any, fileName: string, userId: string) {
    // Check if file with same name exists for this user
    const existingFile = await this.prisma.file.findFirst({
      where: { name: fileName, ownerId: userId },
      include: { versions: true },
    });

    let fileRecord;
    let versionNumber = 1;

    if (existingFile) {
      versionNumber = existingFile.versions.length + 1;
      fileRecord = existingFile;
    } else {
      fileRecord = await this.prisma.file.create({
        data: { name: fileName, ownerId: userId },
        include: { versions: true },
      });
    }

    const filePath = `files/${userId}/${fileRecord.id}/v${versionNumber}-${Date.now()}-${fileName}`;

    await this.minio.putObject('storage', filePath, file.createReadStream(), {
      'Content-Type': file.mimetype,
      'Content-Length': file.size.toString(),
    });

    const version = await this.prisma.fileVersion.create({
      data: {
        fileId: fileRecord.id,
        filePath,
        versionNumber,
        size: BigInt(file.size),
        mimeType: file.mimetype,
      },
    });

    return this.getFile(fileRecord.id, userId);
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);

    // Soft delete - mark as deleted or actually delete versions
    await this.prisma.fileVersion.deleteMany({ where: { fileId } });
    await this.prisma.file.delete({ where: { id: fileId } });

    // Clean up MinIO objects (optional)
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
    });
    for (const version of versions) {
      await this.minio.removeObject('storage', version.filePath);
    }

    return true;
  }

  // Add to existing FilesService class

  async shareFile(
    fileId: string,
    userId: string,
    targetUserId: string,
    role: 'owner' | 'editor' | 'viewer',
  ) {
    const file = await this.getFile(fileId, userId); // Validates ownership

    // Check if permission already exists
    const existingPermission = await this.prisma.permission.findFirst({
      where: { fileId, userId: targetUserId },
    });

    if (existingPermission) {
      return this.prisma.permission.update({
        where: { id: existingPermission.id },
        data: { role },
      });
    }

    return this.prisma.permission.create({
      data: {
        fileId,
        userId: targetUserId,
        role,
      },
    });
  }

  async getSharedFiles(userId: string) {
    return this.prisma.file.findMany({
      where: {
        permissions: {
          some: { userId },
        },
      },
      include: {
        owner: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
        permissions: {
          where: { userId },
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDownloadUrl(fileVersionId: string, userId: string) {
    const version = await this.prisma.fileVersion.findFirst({
      where: {
        id: fileVersionId,
        file: {
          OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
        },
      },
    });

    if (!version)
      throw new NotFoundException('Version not found or access denied');

    return this.minio.generatePresignedUrl(version.filePath, 3600); // 1 hour
  }

  async renameFile(fileId: string, newName: string, userId: string) {
    const file = await this.getFile(fileId, userId);

    // Update all versions with new name prefix
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
    });

    for (const version of versions) {
      const oldPath = version.filePath;
      const newPath = oldPath.replace(/\/[^\/]+$/, `/${newName}`);

      await this.minio.copyObject('storage', newPath, 'storage', oldPath, {});
      await this.minio.removeObject('storage', oldPath);

      await this.prisma.fileVersion.update({
        where: { id: version.id },
        data: { filePath: newPath },
      });
    }

    return this.prisma.file.update({
      where: { id: fileId },
      data: { name: newName },
      include: { versions: true },
    });
  }
}


import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { PubSub } from 'graphql-subscriptions';
import { FILE_UPLOADED, FILE_UPDATED, FILE_DELETED } from './files.constants';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private pubsub: PubSub,
  ) {}

  // Update uploadFile method to publish events
  async uploadFile(file: any, fileName: string, userId: string) {
    const fileRecord = await this.handleFileUpload(file, fileName, userId);
    
    // Publish real-time event
    await this.pubsub.publish(FILE_UPLOADED, { 
      fileUploaded: fileRecord 
    });
    
    return fileRecord;
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);
    
    await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.deleteMany({ where: { fileId } });
      await tx.file.delete({ where: { id: fileId } });
    });
    
    // Cleanup MinIO
    const versions = await this.prisma.fileVersion.findMany({ where: { fileId } });
    for (const version of versions) {
      await this.minio.removeObject('storage', version.filePath);
    }
    
    // Publish delete event
    await this.pubsub.publish(FILE_DELETED, { fileDeleted: fileId });
    
    return true;
  }

  async renameFile(fileId: string, newName: string, userId: string) {
    const updatedFile = await this.handleRename(fileId, newName, userId);
    
    // Publish update event
    await this.pubsub.publish(FILE_UPDATED, { 
      fileUpdated: updatedFile 
    });
    
    return updatedFile;
  }
}


import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary'; // For mime-type validation
import * as fileType from 'magic-bytes.js';
import { PubSub } from 'graphql-subscriptions';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/xml'
];

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private pubsub: PubSub,
  ) {}

  private validateFile(file: any): void {
    // Size validation (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large. Max 10MB.');
    }

    // Mime type validation
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed.');
    }

    // Magic bytes validation (double-check)
    const buffer = Buffer.alloc(4100);
    file.buffer = buffer;
    const detectedType = fileType(file.buffer, { length: 4100 });
    if (!detectedType?.some(t => ALLOWED_MIME_TYPES.includes(t.mime))) {
      throw new BadRequestException('Invalid file type detected.');
    }
  }

  async uploadFile(file: any, fileName: string, userId: string) {
    this.validateFile(file);
    
    const fileRecord = await this.handleFileUpload(file, fileName, userId);
    
    // Encrypted upload
    const filePath = `encrypted/${userId}/${fileRecord.id}/v1-${Date.now()}-${fileName}`;
    await this.minio.encryptAndUpload('storage', filePath, file.createReadStream(), {
      'Content-Type': file.mimetype,
      'Content-Length': file.size.toString(),
      'x-amz-meta-original-name': fileName
    });

    await this.prisma.fileVersion.create({
      data: {
        fileId: fileRecord.id,
        filePath,
        versionNumber: 1,
        size: BigInt(file.size),
        mimeType: file.mimetype
      }
    });

    await this.pubsub.publish(FILE_UPLOADED, { fileUploaded: fileRecord });
    return fileRecord;
  }

  async getSecureDownloadStream(fileVersionId: string, userId: string) {
    const version = await this.prisma.fileVersion.findFirst({
      where: {
        id: fileVersionId,
        file: {
          OR: [
            { ownerId: userId },
            { permissions: { some: { userId } } }
          ]
        }
      }
    });

    if (!version) throw new NotFoundException('Access denied');
    
    return this.minio.decryptDownload(version.filePath);
  }
}

import { KafkaService } from '../kafka/kafka.service';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private pubsub: PubSub,
    private kafka: KafkaService, // Add Kafka
  ) {}

  async uploadFile(file: any, fileName: string, userId: string) {
    this.validateFile(file);
    
    const fileRecord = await this.handleFileUpload(file, fileName, userId);
    
    // 1. GraphQL PubSub (real-time)
    await this.pubsub.publish(FILE_UPLOADED, { fileUploaded: fileRecord });
    
    // 2. Kafka event (async processing, analytics, etc.)
    const event: FileEvent = {
      type: 'FILE_UPLOADED',
      fileId: fileRecord.id,
      userId,
      timestamp: new Date().toISOString(),
      metadata: { fileName, size: file.size }
    };
    
    await this.kafka.publishFileEvent(event);
    
    return fileRecord;
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);
    
    // Publish Kafka event BEFORE deletion
    await this.kafka.publishFileEvent({
      type: 'FILE_DELETED',
      fileId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: { fileName: file.name }
    });
    
    // Perform deletion...
    await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.deleteMany({ where: { fileId } });
      await tx.file.delete({ where: { id: fileId } });
    });
    
    await this.pubsub.publish(FILE_DELETED, { fileDeleted: fileId });
    return true;
  }
}
