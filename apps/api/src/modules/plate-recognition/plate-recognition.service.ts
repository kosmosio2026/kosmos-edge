import { Injectable } from '@nestjs/common';

type RecognizeInput = {
  imageUrl?: string;

  // imageBase64 is for OCR input only.
  // Do not persist this value into DB.
  // The client should send a resized/compressed image, not the original full-size photo.
  imageBase64?: string;

  fileName?: string;
  plateHint?: string;
};

@Injectable()
export class PlateRecognitionService {
  async recognizeKoreanPlate(input: RecognizeInput) {
    const sourceText = [
      input.plateHint,
      input.fileName,
      input.imageUrl,
    ]
      .filter(Boolean)
      .join(' ');

    const detectedPlate =
      this.extractKoreanPlate(sourceText) ??
      '12가3456';

    return {
      provider: 'MOCK_KR_PLATE_OCR',
      mode: 'MOCK',
      country: 'KR',
      plateNumber: this.normalizePlate(detectedPlate),
      confidence: 0.92,
      candidates: [
        {
          plateNumber: this.normalizePlate(detectedPlate),
          confidence: 0.92,
        },
      ],
      imageUrl: input.imageUrl ?? null,
      fileName: input.fileName ?? null,
      imageReceived: Boolean(input.imageUrl || input.imageBase64),
      imageBase64Ignored: Boolean(input.imageBase64),
      message: 'Mock OCR result. Replace provider implementation with real Korean plate OCR later.',
    };
  }

  private extractKoreanPlate(text: string) {
    const normalized = text.replace(/\s+/g, '');

    const patterns = [
      /\d{2,3}[가-힣]\d{4}/,
      /\d{2,3}[A-Za-z]\d{4}/,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match?.[0]) return match[0];
    }

    return null;
  }

  private normalizePlate(plate: string) {
    return plate
      .replace(/\s+/g, '')
      .replace(/-/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0xfee0),
      )
      .toUpperCase();
  }
}
