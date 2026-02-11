import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Shared image validation utilities for secure file upload handling
 */

export interface ImageValidationResult {
  buffer: Buffer;
  extension: string;
  filename: string;
}

/**
 * Validate and process base64 image data with security checks
 * @param base64Data Base64-encoded image data with data URI prefix
 * @param maxSizeMB Maximum allowed file size in MB (default: 5)
 * @param prefix Filename prefix for generated name
 * @returns Validated image buffer, extension, and generated filename
 * @throws BadRequestException if validation fails
 */
export function validateAndProcessBase64Image(
  base64Data: string,
  maxSizeMB: number = 5,
  prefix: string = 'image',
): ImageValidationResult {
  // 1. Validate size before processing (base64 overhead ~1.33x)
  const estimatedSize = (base64Data.length * 0.75);
  const maxBytes = maxSizeMB * 1024 * 1024;
  
  if (estimatedSize > maxBytes) {
    throw new BadRequestException(
      `Kích thước ảnh quá lớn (tối đa ${maxSizeMB}MB)`,
    );
  }

  // 2. Validate MIME type from data URI
  const mimeMatch = base64Data.match(/^data:(image\/(jpeg|jpg|png|gif|webp));base64,/);
  if (!mimeMatch) {
    throw new BadRequestException(
      'Ảnh phải có định dạng JPEG, PNG, GIF hoặc WebP',
    );
  }

  const mimeType = mimeMatch[1];
  const ext = mimeMatch[2] === 'jpeg' ? 'jpg' : mimeMatch[2];

  // 3. Decode base64 to buffer
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  let buffer: Buffer;
  
  try {
    buffer = Buffer.from(base64Content, 'base64');
  } catch (err) {
    throw new BadRequestException('Dữ liệu base64 không hợp lệ');
  }

  // 4. Validate actual buffer size matches estimate
  if (buffer.length > maxBytes) {
    throw new BadRequestException(
      `Kích thước ảnh thực tế vượt quá giới hạn ${maxSizeMB}MB`,
    );
  }

  // 5. Validate magic bytes (file signature) for security
  const isValidImage = validateImageMagicBytes(buffer, ext);
  if (!isValidImage) {
    throw new BadRequestException(
      `File không phải ảnh ${ext.toUpperCase()} hợp lệ`,
    );
  }

  // 6. Generate secure random filename
  const randomSuffix = randomBytes(8).toString('hex');
  const timestamp = Date.now();
  const filename = `${prefix}_${timestamp}_${randomSuffix}.${ext}`;

  return { buffer, extension: ext, filename };
}

/**
 * Validate file magic bytes (file signature) to prevent file type spoofing
 * @param buffer File buffer
 * @param expectedExt Expected file extension
 * @returns true if magic bytes match the expected type
 */
function validateImageMagicBytes(buffer: Buffer, expectedExt: string): boolean {
  if (buffer.length < 12) return false;

  const magicBytes = buffer.slice(0, 12);
  
  switch (expectedExt) {
    case 'jpg':
      // JPEG: FF D8 FF
      return magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    
    case 'png':
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      return (
        magicBytes[0] === 0x89 &&
        magicBytes[1] === 0x50 &&
        magicBytes[2] === 0x4E &&
        magicBytes[3] === 0x47
      );
    
    case 'gif':
      // GIF: 47 49 46 38 (GIF8)
      return (
        magicBytes[0] === 0x47 &&
        magicBytes[1] === 0x49 &&
        magicBytes[2] === 0x46 &&
        magicBytes[3] === 0x38
      );
    
    case 'webp':
      // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
      return (
        magicBytes[0] === 0x52 &&
        magicBytes[1] === 0x49 &&
        magicBytes[2] === 0x46 &&
        magicBytes[3] === 0x46 &&
        magicBytes[8] === 0x57 &&
        magicBytes[9] === 0x45 &&
        magicBytes[10] === 0x42 &&
        magicBytes[11] === 0x50
      );
    
    default:
      return false;
  }
}
