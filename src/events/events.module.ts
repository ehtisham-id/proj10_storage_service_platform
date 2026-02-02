import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { EventsService } from './events.service';

@Module({
  imports: [KafkaModule],
  providers: [EventsService],
})
export class EventsModule {}
