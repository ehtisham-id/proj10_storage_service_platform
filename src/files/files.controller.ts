import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private prisma: PrismaService,
  ) {}

  @Get('download/:versionId')
  @UseGuards(AuthGuard('jwt'))
  async downloadFile(
    @Param('versionId') versionId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user.sub;

    // Get version info for headers
    const version = await this.prisma.fileVersion.findFirst({
      where: {
        id: versionId,
        file: {
          OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
        },
      },
      include: { file: true },
    });

    if (!version) {
      throw new NotFoundException('File not found or access denied');
    }

    const stream = await this.filesService.getSecureDownloadStream(
      versionId,
      userId,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(version.file.name)}"`,
    );
    if (version.mimeType) {
      res.setHeader('Content-Type', version.mimeType);
    }

    stream.pipe(res);
  }
}
