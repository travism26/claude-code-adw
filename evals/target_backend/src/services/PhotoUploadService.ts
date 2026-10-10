import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { logApi } from './logging/logger';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  THUMBNAIL_SIZE,
  UPLOAD_DIR,
} from '../config/upload';

interface FileValidationResult {
  valid: boolean;
  error?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Low-level file handling service for photo uploads.
 * Framework-agnostic (no Express types) for reuse across workers.
 */
export class PhotoUploadService {
  /**
   * Validate uploaded file based on MIME type and size.
   */
  static validateFile(
    file: { mimetype: string; size: number; originalname: string },
    maxSizeBytes: number = MAX_FILE_SIZE_BYTES
  ): FileValidationResult {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
      const fileMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File too large: ${fileMB}MB. Maximum allowed: ${maxMB}MB`,
      };
    }

    // Check if file has content
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty',
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize filename to prevent path traversal and special characters.
   */
  static sanitizeFilename(filename: string): string {
    // Remove path components and special characters
    const sanitized = filename
      .replace(/^.*[\\\/]/, '') // Remove path separators
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .substring(0, 200); // Limit length

    // If filename is empty after sanitization, use a default
    return sanitized || 'upload';
  }

  /**
   * Generate unique storage path for a file.
   * Returns a relative path from process.cwd() for database storage.
   */
  static generateStoragePath(userId: string, growId: string, filename: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(sanitizedFilename);
    const basename = path.basename(sanitizedFilename, ext);
    const uniqueFilename = `${timestamp}_${randomSuffix}_${basename}${ext}`;

    const uploadDir = UPLOAD_DIR; // Use relative path from config
    const relativePath = path.join(userId, growId, uniqueFilename);
    return path.join(uploadDir, relativePath);
  }

  /**
   * Ensure directory exists, creating it if necessary.
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      logApi.error('Failed to create directory', {
        dirPath,
        error: error.message,
      });
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Save file buffer to disk.
   * Accepts a relative path and converts to absolute path for file operations.
   */
  static async saveFile(buffer: Buffer, filePath: string): Promise<void> {
    try {
      // Convert relative path to absolute for file operations
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      const directory = path.dirname(absolutePath);
      await this.ensureDirectory(directory);
      await fs.writeFile(absolutePath, buffer);
      logApi.info('File saved successfully', { filePath });
    } catch (error: any) {
      logApi.error('Failed to save file', {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }

  /**
   * Get image dimensions from buffer using sharp.
   */
  static async getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error: any) {
      logApi.error('Failed to get image dimensions', {
        error: error.message,
      });
      throw new Error(`Failed to get image dimensions: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail for an image.
   * Accepts a relative path and returns a relative thumbnail path.
   */
  static async generateThumbnail(
    buffer: Buffer,
    sourcePath: string,
    size: number = THUMBNAIL_SIZE
  ): Promise<string> {
    try {
      const ext = path.extname(sourcePath);
      const basename = path.basename(sourcePath, ext);
      const directory = path.dirname(sourcePath);
      const thumbnailPath = path.join(directory, `${basename}_thumb${ext}`);

      // Convert to absolute path for file operations
      const absoluteThumbnailPath = path.isAbsolute(thumbnailPath)
        ? thumbnailPath
        : path.join(process.cwd(), thumbnailPath);

      await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .toFile(absoluteThumbnailPath);

      logApi.info('Thumbnail generated successfully', {
        sourcePath,
        thumbnailPath,
        size,
      });

      return thumbnailPath; // Return relative path for DB storage
    } catch (error: any) {
      logApi.error('Failed to generate thumbnail', {
        sourcePath,
        error: error.message,
      });
      throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
  }

  /**
   * Delete file from filesystem.
   * Accepts a relative path and converts to absolute path for file operations.
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      // Convert relative path to absolute for file operations
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      await fs.unlink(absolutePath);
      logApi.info('File deleted successfully', { filePath });
    } catch (error: any) {
      // Ignore ENOENT errors (file already deleted)
      if (error.code === 'ENOENT') {
        logApi.warn('File not found during deletion', { filePath });
        return;
      }
      logApi.error('Failed to delete file', {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from filesystem.
   */
  static async deleteFiles(filePaths: string[]): Promise<void> {
    const deletePromises = filePaths.map((filePath) => this.deleteFile(filePath));
    await Promise.allSettled(deletePromises);
  }
}

export default PhotoUploadService;
