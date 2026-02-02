import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FilesService } from './files.service';
import { File, CreateFileInput } from './dto/file.input';

@Resolver(() => File)
export class FilesResolver {
  constructor(private filesService: FilesService) {}

  @Query(() => [File])
  @UseGuards(GqlAuthGuard)
  async getFiles(@CurrentUser() user: any) {
    return this.filesService.getFiles(user.sub);
  }

  @Query(() => File)
  @UseGuards(GqlAuthGuard)
  async getFile(@Args('id') id: string, @CurrentUser() user: any) {
    return this.filesService.getFile(id, user.sub);
  }

  @Query(() => [FileVersion])
  @UseGuards(GqlAuthGuard)
  async getFileVersions(
    @Args('fileId') fileId: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.getFileVersions(fileId, user.sub);
  }

  @Mutation(() => File)
  @UseGuards(GqlAuthGuard)
  async uploadFile(
    @Args({ name: 'file', type: () => GraphQLUpload }) file: any,
    @Args('fileName') fileName: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.uploadFile(file, fileName, user.sub);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteFile(@Args('fileId') fileId: string, @CurrentUser() user: any) {
    return this.filesService.deleteFile(fileId, user.sub);
  }

  // Add to existing FilesResolver class

  @Query(() => [File])
  @UseGuards(GqlAuthGuard)
  async getSharedFiles(@CurrentUser() user: any) {
    return this.filesService.getSharedFiles(user.sub);
  }

  @Mutation(() => Permission)
  @UseGuards(GqlAuthGuard)
  async shareFile(
    @Args('fileId') fileId: string,
    @Args('userId') userId: string,
    @Args('role') role: 'owner' | 'editor' | 'viewer',
    @CurrentUser() user: any,
  ) {
    return this.filesService.shareFile(fileId, user.sub, userId, role);
  }

  @Mutation(() => File)
  @UseGuards(GqlAuthGuard)
  async renameFile(
    @Args('fileId') fileId: string,
    @Args('newName') newName: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.renameFile(fileId, newName, user.sub);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard)
  async getDownloadUrl(
    @Args('fileVersionId') fileVersionId: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.getDownloadUrl(fileVersionId, user.sub);
  }
}


import { 
  Resolver, 
  Query, 
  Mutation, 
  Args, 
  Subscription,
  WithFilteredType 
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { FILE_UPLOADED, FILE_UPDATED, FILE_DELETED } from './files.constants';

@Resolver(() => File)
export class FilesResolver {
  constructor(
    private filesService: FilesService,
    private pubsub: PubSub
  ) {}

  // Existing resolvers...

  @Subscription(() => File)
  @UseGuards(GqlAuthGuard)
  fileUploaded() {
    return this.pubsub.asyncIterator(FILE_UPLOADED);
  }

  @Subscription(() => File)
  @UseGuards(GqlAuthGuard)
  fileUpdated() {
    return this.pubsub.asyncIterator(FILE_UPDATED);
  }

  @Subscription(() => String)
  @UseGuards(GqlAuthGuard)
  fileDeleted() {
    return this.pubsub.asyncIterator(FILE_DELETED);
  }
}
