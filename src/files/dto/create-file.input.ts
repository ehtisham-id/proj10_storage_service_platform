import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { FileUpload, GraphQLUpload } from 'graphql-upload';

@InputType()
export class UploadFileInput {
  @Field(() => GraphQLUpload)
  @IsString()
  file: Promise<FileUpload>;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9._-]+$/i, { message: 'Invalid filename' })
  fileName: string;
}
