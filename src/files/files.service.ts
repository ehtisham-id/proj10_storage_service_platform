import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { PubSub } from 'graphql-subscriptions';
import { FILE_UPLOADED, FILE_UPDATED, FILE_DELETED } from './files.constants';
import fileType from 'magic-bytes.js';
import * as Minio from 'minio';
import { FileEvent, KafkaService } from '../kafka/kafka.service';
import { FileUpload } from 'graphql-upload';
import { Readable } from 'stream';


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
    private kafka: KafkaService,
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

  async uploadFile(file: FileUpload, fileName: string, userId: string) {
    const prepared = await this.prepareUpload(file);
    this.validateFile(prepared);
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

    await this.minio.encryptAndUpload('storage', filePath, prepared.stream, {
      'Content-Type': prepared.mimetype,
      'Content-Length': prepared.size.toString(),
      'x-amz-meta-original-name': fileName
    });



    const version = await this.prisma.fileVersion.create({
      data: {
        fileId: fileRecord.id,
        filePath,
        versionNumber,
        size: BigInt(prepared.size),
        mimeType: prepared.mimetype,
      },
    });

    await this.pubsub.publish(FILE_UPLOADED, {
      fileUploaded: fileRecord
    });

    // 2. Kafka event (async processing, analytics, etc.)
    const event: FileEvent = {
      type: 'FILE_UPLOADED',
      fileId: fileRecord.id,
      userId,
      timestamp: new Date().toISOString(),
      metadata: { fileName, size: prepared.size }
    };

    await this.kafka.publishFileEvent(event);

    return this.getFile(fileRecord.id, userId);
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);

    // Soft delete - mark as deleted or actually delete versions
    await this.kafka.publishFileEvent({
      type: 'FILE_DELETED',
      fileId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: { fileName: file.name }
    });

    // Clean up MinIO objects (optional)
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId },
    });

    // Perform deletion...
    await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.deleteMany({ where: { fileId } });
      await tx.file.delete({ where: { id: fileId } });
    });

    await this.pubsub.publish(FILE_DELETED, { fileDeleted: fileId });

    for (const version of versions) {
      await this.minio.removeObject('storage', version.filePath);
    }

    return true;
  }


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

      await this.minio.copyObject(
        'storage',
        newPath,
        `/storage/${oldPath}`,
        new Minio.CopyConditions(),
      );
      await this.minio.removeObject('storage', oldPath);

      await this.prisma.fileVersion.update({
        where: { id: version.id },
        data: { filePath: newPath },
      });
    }
    
    await this.pubsub.publish(FILE_UPDATED, {
      fileUpdated: file
    });

    return this.prisma.file.update({
      where: { id: fileId },
      data: { name: newName },
      include: { versions: true },
    });
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
  
  private validateFile(file: {
    size: number;
    mimetype: string;
    buffer: Buffer;
  }): void {
    // Size validation (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large. Max 10MB.');
    }

    // Mime type validation
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed.');
    }

    const detectedType = fileType(file.buffer) || [];
    const isDetectedAllowed = detectedType.some((t) =>
      t.mime ? ALLOWED_MIME_TYPES.includes(t.mime) : false,
    );
    const isTextLike =
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/xml';

    if (!isDetectedAllowed && !isTextLike) {
      throw new BadRequestException('Invalid file type detected.');
    }
  }

  private async prepareUpload(file: FileUpload) {
    const stream = file.createReadStream();
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of stream) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bufferChunk.length;
      if (total > 10 * 1024 * 1024) {
        throw new BadRequestException('File too large. Max 10MB.');
      }
      chunks.push(bufferChunk);
    }

    const buffer = Buffer.concat(chunks);
    return {
      buffer,
      size: buffer.length,
      mimetype: file.mimetype,
      stream: Readable.from(buffer),
    };
  }
}
