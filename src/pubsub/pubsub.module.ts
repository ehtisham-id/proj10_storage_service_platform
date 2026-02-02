import { Module } from '@nestjs/common';
import { GraphQLSubscriptionsModule } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';

@Module({
  imports: [GraphQLSubscriptionsModule.forRoot({
    driver: PubSub,
  })],
  exports: [PubSub],
  providers: [PubSub],
})
export class PubSubModule {}
