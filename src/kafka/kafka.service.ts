import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export interface FileEvent {
  type: 'FILE_UPLOADED' | 'FILE_UPDATED' | 'FILE_DELETED';
  fileId: string;
  userId: string;
  timestamp: string;
  metadata: any;
}

@Injectable()
export class KafkaService {
  constructor(
    @Inject('KAFKA_PRODUCER') private client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async publishFileEvent(event: FileEvent) {
    await this.client.emit(`file-events`, event).toPromise();
  }

  async getFileEvents(): Promise<Observable<any>> {
    return this.client.subscribeToResponseOf('file-events');
  }
}
