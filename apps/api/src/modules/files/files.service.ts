import { Injectable } from '@nestjs/common';

@Injectable()
export class FilesService {
  buildPublicUrl(kind: string, filename: string) {
    const publicBaseUrl =
      process.env.PUBLIC_API_BASE_URL ??
      process.env.API_PUBLIC_BASE_URL ??
      'http://112.171.47.68:3000';

    return `${publicBaseUrl.replace(/\/$/, '')}/uploads/${kind}/${filename}`;
  }
}
