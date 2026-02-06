import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { ClientKafka } from '@nestjs/microservices';
import { FileEvent } from '../kafka/kafka.service';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @Inject('KAFKA_PRODUCER') private client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.subscribeToResponseOf('file-events');
    await this.client.connect();
  }

  @EventPattern('file-events')
  async handleFileEvent(event: FileEvent) {
    console.log('📦 Kafka Event:', event.type, event.fileId);
    
    switch (event.type) {
      case 'FILE_UPLOADED':
        await this.handleFileUploadEvent(event);
        break;
      case 'FILE_DELETED':
        await this.handleFileDeleteEvent(event);
        break;
    }
  }

  private async handleFileUploadEvent(event: FileEvent) {
    // Generate thumbnails, send notifications, update analytics
    console.log('✅ Processing upload analytics for:', event.fileId);
    
    // Example: Update user storage quota
    // await this.updateUserQuota(event.userId, event.metadata.size);
  }

  private async handleFileDeleteEvent(event: FileEvent) {
    // Update analytics, free storage quota
    console.log('🗑️ Processing delete analytics for:', event.fileId);
  }
}
