import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class MinioService extends Minio.Client implements OnModuleInit {
  private encryptionKey: Buffer;

  constructor() {
    super({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
    
    // Generate fixed encryption key from env (32 bytes for AES-256)
    this.encryptionKey = Buffer.from(
      crypto.createHash('sha256')
        .update(process.env.MINIO_SECRET_KEY || 'default')
        .digest('hex').slice(0, 32),
      'hex'
    );
  }

  async onModuleInit() {
    await this.bucketExists('storage').catch(() => 
      this.makeBucket('storage', 'US_EAST_1')
    );
  }

  async encryptAndUpload(
    bucket: string, 
    objectName: string, 
    stream: Readable, 
    metadata?: any
  ) {
    const cipher = crypto.createCipher('aes256', this.encryptionKey);
    
    // Pipe: stream -> encrypt -> MinIO
    const encryptedStream = stream.pipe(cipher);
    
    return this.putObject(bucket, objectName, encryptedStream, metadata);
  }

  async decryptDownload(objectName: string): Promise<Readable> {
    const encryptedStream = await this.getObject('storage', objectName);
    const decipher = crypto.createDecipher('aes256', this.encryptionKey);
    
    return encryptedStream.pipe(decipher);
  }

  async generatePresignedUrl(filePath: string, expires: number = 3600) {
    return this.presignedGetObject('storage', filePath, expires);
  }
}
