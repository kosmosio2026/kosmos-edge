import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FilesService } from './files.service';

const uploadKind = 'vehicle-plate-photos';
const uploadDir = join(process.cwd(), '../../uploads', uploadKind);

mkdirSync(uploadDir, { recursive: true });

function safeExt(originalName: string) {
  const ext = extname(originalName).toLowerCase();

  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return ext;
  }

  return '.jpg';
}

function makeFilename(originalName: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}${safeExt(originalName)}`;
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('vehicle-plate-photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req: any, file: any, callback: any) => {
          callback(null, makeFilename(file.originalname));
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      fileFilter: (_req: any, file: any, callback: any) => {
        if (!file.mimetype?.startsWith('image/')) {
          callback(new BadRequestException('Only image files are allowed'), false);
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadVehiclePlatePhoto(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const imageUrl = this.filesService.buildPublicUrl(uploadKind, file.filename);

    return {
      kind: uploadKind,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      imageUrl,
    };
  }
}
