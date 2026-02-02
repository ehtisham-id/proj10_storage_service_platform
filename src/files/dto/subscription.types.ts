import { Field, ObjectType, ID } from '@nestjs/graphql';
import { File } from './file.input';

@ObjectType()
export class FileSubscriptionPayload {
  @Field(() => File)
  fileUploaded: File;

  @Field(() => File)
  fileUpdated: File;

  @Field(() => ID)
  fileDeleted: string;
}
