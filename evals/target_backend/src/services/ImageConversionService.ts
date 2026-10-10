/**
 * Image Conversion Service
 *
 * Utilities for processing images for AI vision API calls:
 * - Read images from disk and convert to base64
 * - Resize images to optimal dimensions (reduces API costs)
 * - Determine MIME types from file extensions
 * - Validate image sizes
 */

import fs from 'fs/promises';
import sharp from 'sharp';
import path from 'path';
import { logAI } from './logging/logger';

export class ImageConversionService {
  /**
   * Read image file from disk and convert to base64
   * @param filePath - Absolute path to image file
   * @returns Base64 encoded string (without data URI prefix)
   */
  static async readImageAsBase64(filePath: string): Promise<string> {
    try {
      logAI.debug('Reading image file', {
        service: 'ImageConversionService',
        filePath,
      });

      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString('base64');

      logAI.debug('Image read successfully', {
        service: 'ImageConversionService',
        filePath,
        originalSize: buffer.length,
        base64Length: base64.length,
      });

      return base64;
    } catch (error) {
      logAI.error('Failed to read image file', {
        service: 'ImageConversionService',
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Resize image to maximum dimensions while preserving aspect ratio
   * Uses sharp library for efficient image processing
   *
   * @param buffer - Image buffer (raw file data)
   * @param maxWidth - Maximum width in pixels (default: 1024)
   * @param maxHeight - Maximum height in pixels (default: 1024)
   * @returns Resized image buffer
   */
  static async resizeImage(
    buffer: Buffer,
    maxWidth = 1024,
    maxHeight = 1024
  ): Promise<Buffer> {
    try {
      logAI.debug('Resizing image', {
        service: 'ImageConversionService',
        originalSize: buffer.length,
        maxWidth,
        maxHeight,
      });

      const resized = await sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      logAI.debug('Image resized successfully', {
        service: 'ImageConversionService',
        originalSize: buffer.length,
        resizedSize: resized.length,
        compressionRatio: (resized.length / buffer.length).toFixed(2),
      });

      return resized;
    } catch (error) {
      logAI.error('Failed to resize image', {
        service: 'ImageConversionService',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`Failed to resize image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Determine MIME type from file extension
   * Supports common image formats used in cannabis cultivation photos
   *
   * @param filePath - Path to image file
   * @returns MIME type string (e.g., 'image/jpeg')
   */
  static getImageMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg'; // Default to JPEG

    logAI.debug('Determined MIME type', {
      service: 'ImageConversionService',
      filePath,
      extension: ext,
      mimeType,
    });

    return mimeType;
  }

  /**
   * Validate image file size
   * Ensures file is within acceptable limits for processing
   *
   * @param filePath - Path to image file
   * @param maxSizeMB - Maximum size in megabytes
   * @returns True if file size is within limit
   */
  static async validateImageSize(filePath: string, maxSizeMB = 10): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      const sizeMB = stats.size / (1024 * 1024);

      logAI.debug('Validating image size', {
        service: 'ImageConversionService',
        filePath,
        sizeBytes: stats.size,
        sizeMB: sizeMB.toFixed(2),
        maxSizeMB,
        valid: sizeMB <= maxSizeMB,
      });

      return sizeMB <= maxSizeMB;
    } catch (error) {
      logAI.error('Failed to validate image size', {
        service: 'ImageConversionService',
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Process image for vision API: read, resize, and convert to base64
   * This is a convenience method that combines all processing steps
   *
   * @param filePath - Absolute path to image file
   * @param maxWidth - Maximum width in pixels (default: 1024)
   * @param maxHeight - Maximum height in pixels (default: 1024)
   * @returns Object with base64 string and MIME type
   */
  static async processImageForVisionAPI(
    filePath: string,
    maxWidth = 1024,
    maxHeight = 1024
  ): Promise<{ base64: string; mimeType: string }> {
    try {
      logAI.info('Processing image for vision API', {
        service: 'ImageConversionService',
        filePath,
        maxWidth,
        maxHeight,
      });

      // Read original image
      const originalBuffer = await fs.readFile(filePath);

      // Resize image
      const resizedBuffer = await this.resizeImage(originalBuffer, maxWidth, maxHeight);

      // Convert to base64
      const base64 = resizedBuffer.toString('base64');

      // Get MIME type
      const mimeType = this.getImageMimeType(filePath);

      logAI.info('Image processed successfully for vision API', {
        service: 'ImageConversionService',
        filePath,
        originalSize: originalBuffer.length,
        resizedSize: resizedBuffer.length,
        base64Length: base64.length,
        mimeType,
      });

      return { base64, mimeType };
    } catch (error) {
      logAI.error('Failed to process image for vision API', {
        service: 'ImageConversionService',
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`Failed to process image for vision API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
