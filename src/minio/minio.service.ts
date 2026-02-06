import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import { PassThrough, Readable } from 'stream';

@Injectable()
export class MinioService extends Minio.Client implements OnModuleInit {
  private encryptionKey: Buffer;

  constructor() {
    const { endPoint, port, useSSL } = MinioService.parseEndpoint(
      process.env.MINIO_ENDPOINT || 'localhost',
      Number(process.env.MINIO_PORT || 9000),
    );

    super({
      endPoint,
      port,
      useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    // 32-byte key for AES-256 derived from secret
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(process.env.MINIO_SECRET_KEY || 'default')
      .digest();
  }

  async onModuleInit() {
    const exists = await this.bucketExists('storage');
    if (!exists) {
      await this.makeBucket('storage', 'us-east-1');
    }
  }

  async encryptAndUpload(
    bucket: string,
    objectName: string,
    stream: Readable,
    metadata?: any,
  ) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', this.encryptionKey, iv);

    const passThrough = new PassThrough();
    passThrough.write(iv);
    stream.pipe(cipher).pipe(passThrough);

    return this.putObject(bucket, objectName, passThrough, metadata);
  }

  async decryptDownload(objectName: string): Promise<Readable> {
    const encryptedStream = await this.getObject('storage', objectName);
    const iv = await MinioService.readIv(encryptedStream);
    const decipher = crypto.createDecipheriv(
      'aes-256-ctr',
      this.encryptionKey,
      iv,
    );

    return encryptedStream.pipe(decipher);
  }

  private static parseEndpoint(raw: string, fallbackPort: number) {
    const cleaned = raw.replace(/^https?:\/\//, '');
    const [host, portRaw] = cleaned.split(':');
    const port = portRaw ? Number(portRaw) : fallbackPort;
    const useSSL = raw.startsWith('https://');
    return { endPoint: host, port, useSSL };
  }

  private static async readIv(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;

      function onData(chunk: Buffer) {
        chunks.push(chunk);
        total += chunk.length;
        if (total >= 16) {
          stream.pause();
          stream.removeListener('data', onData);
          stream.removeListener('error', onError);
          stream.removeListener('end', onEnd);

          const buffer = Buffer.concat(chunks, total);
          const iv = buffer.subarray(0, 16);
          const rest = buffer.subarray(16);
          if (rest.length > 0) {
            stream.unshift(rest);
          }
          resolve(iv);
        }
      }

      function onEnd() {
        reject(new Error('Invalid encrypted stream'));
      }

      function onError(err: Error) {
        reject(err);
      }

      stream.on('data', onData);
      stream.once('end', onEnd);
      stream.once('error', onError);
    });
  }
}
