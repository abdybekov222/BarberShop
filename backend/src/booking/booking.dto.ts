import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsUuidLike } from '../common/uuid';

/** DTO для создания бронирования. */
export class CreateBookingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUuidLike({ each: true })
  serviceIds!: string[];

  /** UUID мастера или 'any' — «Любой свободный». */
  @IsString()
  masterId!: string;

  @IsISO8601()
  startsAt!: string; // ISO UTC

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Телефон клиента; нормализуется в E.164 (+996XXXXXXXXX) на сервере. */
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /** Образ из ИИ-зеркала, с которым клиент записывается (виден мастеру). */
  @IsOptional()
  @IsUuidLike()
  aiGenerationId?: string;
}

/** DTO для отмены бронирования. */
export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
