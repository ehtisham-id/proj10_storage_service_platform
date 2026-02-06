import { Field, ObjectType, ID, Int, InputType } from '@nestjs/graphql';
import { User } from '../../user/user.model';

@ObjectType()
export class FileVersion {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  fileId: string;

  @Field(() => Int)
  versionNumber: number;

  @Field()
  filePath: string;

  @Field({ nullable: true })
  size?: number;

  @Field({ nullable: true })
  mimeType?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class Permission {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => ID)
  fileId: string;

  @Field()
  role: string;
}

@ObjectType()
export class File {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => User)
  owner: User;

  @Field(() => [FileVersion])
  versions: FileVersion[];

  @Field(() => [Permission])
  permissions: Permission[];

  @Field()
  createdAt: Date;

  @Field(() => String)
  get latestDownloadUrl(): string {
    return this.versions?.[0]?.filePath || '';
  }
}

@InputType()
export class ShareFileInput {
  @Field()
  fileId: string;

  @Field()
  userId: string;

  @Field()
  role: 'owner' | 'editor' | 'viewer';
}
