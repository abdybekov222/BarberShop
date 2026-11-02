import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import type { AiGenerationInput, AiGenerationResult, AiProvider } from './ai-provider.interface';

/**
 * MockProvider — для локальной разработки и демо.
 * Не делает платных запросов: возвращает фото клиента в чёрно-золотой
 * обработке с названием образа, чтобы весь сценарий ЛК работал end-to-end.
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  async generate({ photo, style }: AiGenerationInput): Promise<AiGenerationResult> {
    this.logger.log(`[MOCK] generate style=${style.name}`);
    await new Promise((r) => setTimeout(r, 3000));

    const img = sharp(photo);
    const { width = 768, height = 768 } = await img.metadata();
    const fontSize = Math.round(width / 18);
    const label = style.name.replace(/[<>&]/g, '');
    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="${height - fontSize * 2.4}" width="${width}" height="${fontSize * 2.4}" fill="rgba(10,10,10,0.72)"/>
        <rect x="${fontSize}" y="${height - fontSize * 2.4}" width="${width - fontSize * 2}" height="1" fill="#C9A24B"/>
        <text x="50%" y="${height - fontSize * 0.95}" text-anchor="middle" font-family="Georgia, serif"
              font-size="${fontSize}" fill="#C9A24B">${label}</text>
      </svg>`,
    );

    const image = await img
      .modulate({ saturation: 0.6, brightness: 1.03 })
      .tint({ r: 214, g: 190, b: 140 })
      .composite([{ input: overlay }])
      .jpeg({ quality: 85 })
      .toBuffer();

    return { image, costUsd: 0, providerJobId: `mock-${Date.now()}` };
  }
}
