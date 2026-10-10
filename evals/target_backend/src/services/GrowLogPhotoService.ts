import { GrowLogPhoto, GrowLog, Grow } from '../models';
import { PhotoUploadService } from './PhotoUploadService';
import { GrowLogService } from './GrowLogService';
import { logApi } from './logging/logger';

interface UploadFileData {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

interface PhotoUploadResult {
  id: string;
  grow_log_id: string;
  file_path: string;
  thumbnail_path: string | null;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  is_cover: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * GrowLogPhotoService - Business logic for grow log photo operations
 */
export const GrowLogPhotoService = {
  /**
   * Upload photos to a grow log entry
   */
  async uploadPhotos(
    userId: string,
    growLogId: string,
    files: UploadFileData[],
    captions?: (string | null)[]
  ): Promise<PhotoUploadResult[]> {
    // Verify user owns the grow log
    const growLog = await GrowLogService.findById(growLogId);
    if (!growLog) {
      logApi.warn('Grow log not found for photo upload', { growLogId, userId });
      throw new Error('Grow log not found');
    }

    if (!growLog.grow || growLog.grow.user_id !== userId) {
      logApi.warn('Unauthorized photo upload attempt', { growLogId, userId });
      throw new Error('Unauthorized: You do not own this grow log');
    }

    const uploadedPhotos: PhotoUploadResult[] = [];
    const uploadedFiles: string[] = [];

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const caption = captions?.[i] || null;

        // Validate file
        const validation = PhotoUploadService.validateFile(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Generate storage path
        const filePath = PhotoUploadService.generateStoragePath(
          userId,
          growLog.grow_id,
          file.originalname
        );

        // Get image dimensions
        const dimensions = await PhotoUploadService.getImageDimensions(file.buffer);

        // Save file to disk
        await PhotoUploadService.saveFile(file.buffer, filePath);
        uploadedFiles.push(filePath);

        // Generate thumbnail
        let thumbnailPath: string | null = null;
        try {
          thumbnailPath = await PhotoUploadService.generateThumbnail(file.buffer, filePath);
          uploadedFiles.push(thumbnailPath);
        } catch (error: any) {
          logApi.warn('Failed to generate thumbnail, continuing without it', {
            filePath,
            error: error.message,
          });
        }

        // Create database record
        const photo = await GrowLogPhoto.create({
          grow_log_id: growLogId,
          file_path: filePath,
          thumbnail_path: thumbnailPath,
          original_filename: file.originalname,
          mime_type: file.mimetype,
          file_size_bytes: file.size,
          width: dimensions.width,
          height: dimensions.height,
          caption,
          is_cover: false,
        });

        uploadedPhotos.push(photo.toJSON() as PhotoUploadResult);

        logApi.info('Photo uploaded successfully', {
          photoId: photo.id,
          growLogId,
          userId,
          filename: file.originalname,
        });
      }

      return uploadedPhotos;
    } catch (error: any) {
      // Cleanup uploaded files on error
      logApi.error('Photo upload failed, cleaning up files', {
        uploadedFiles: uploadedFiles.length,
        error: error.message,
      });
      await PhotoUploadService.deleteFiles(uploadedFiles);
      throw error;
    }
  },

  /**
   * Get all photos for a grow log entry
   */
  async getPhotos(userId: string, growLogId: string): Promise<GrowLogPhoto[]> {
    // Verify user owns the grow log
    const growLog = await GrowLogService.findById(growLogId);
    if (!growLog) {
      logApi.warn('Grow log not found for photo retrieval', { growLogId, userId });
      throw new Error('Grow log not found');
    }

    if (!growLog.grow || growLog.grow.user_id !== userId) {
      logApi.warn('Unauthorized photo retrieval attempt', { growLogId, userId });
      throw new Error('Unauthorized: You do not own this grow log');
    }

    const photos = await GrowLogPhoto.findAll({
      where: { grow_log_id: growLogId },
      order: [['created_at', 'ASC']],
    });

    logApi.info('Photos retrieved successfully', {
      growLogId,
      userId,
      count: photos.length,
    });

    return photos;
  },

  /**
   * Delete a photo
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    // Find photo with grow log relationship
    const photo = await GrowLogPhoto.findOne({
      where: { id: photoId },
      include: [
        {
          model: GrowLog,
          as: 'growLog',
          include: [
            {
              model: Grow,
              as: 'grow',
              attributes: ['id', 'user_id'],
            },
          ],
        },
      ],
    });

    if (!photo) {
      logApi.warn('Photo not found for deletion', { photoId, userId });
      throw new Error('Photo not found');
    }

    if (!photo.growLog?.grow || photo.growLog.grow.user_id !== userId) {
      logApi.warn('Unauthorized photo deletion attempt', { photoId, userId });
      throw new Error('Unauthorized: You do not own this photo');
    }

    const filePath = photo.file_path;
    const thumbnailPath = photo.thumbnail_path;

    // Delete database record first
    await photo.destroy();

    // Delete physical files
    const filesToDelete = [filePath];
    if (thumbnailPath) {
      filesToDelete.push(thumbnailPath);
    }
    await PhotoUploadService.deleteFiles(filesToDelete);

    logApi.info('Photo deleted successfully', { photoId, userId });
  },

  /**
   * Set a photo as the cover photo for a grow log entry
   */
  async setCoverPhoto(userId: string, growLogId: string, photoId: string): Promise<GrowLogPhoto> {
    // Verify user owns the grow log
    const growLog = await GrowLogService.findById(growLogId);
    if (!growLog) {
      logApi.warn('Grow log not found for cover photo setting', { growLogId, userId });
      throw new Error('Grow log not found');
    }

    if (!growLog.grow || growLog.grow.user_id !== userId) {
      logApi.warn('Unauthorized cover photo setting attempt', { growLogId, userId });
      throw new Error('Unauthorized: You do not own this grow log');
    }

    // Find the photo to set as cover
    const photo = await GrowLogPhoto.findOne({
      where: {
        id: photoId,
        grow_log_id: growLogId,
      },
    });

    if (!photo) {
      logApi.warn('Photo not found in grow log for cover photo setting', {
        photoId,
        growLogId,
        userId,
      });
      throw new Error('Photo not found in this grow log');
    }

    // Unset existing cover photo
    await GrowLogPhoto.update(
      { is_cover: false },
      {
        where: {
          grow_log_id: growLogId,
          is_cover: true,
        },
      }
    );

    // Set new cover photo
    await photo.update({ is_cover: true });

    logApi.info('Cover photo set successfully', {
      photoId,
      growLogId,
      userId,
    });

    return photo;
  },

  /**
   * Get a single photo by ID with ownership verification
   */
  async getPhotoById(userId: string, photoId: string): Promise<GrowLogPhoto | null> {
    const photo = await GrowLogPhoto.findOne({
      where: { id: photoId },
      include: [
        {
          model: GrowLog,
          as: 'growLog',
          include: [
            {
              model: Grow,
              as: 'grow',
              attributes: ['id', 'user_id'],
            },
          ],
        },
      ],
    });

    if (!photo) {
      return null;
    }

    if (!photo.growLog?.grow || photo.growLog.grow.user_id !== userId) {
      logApi.warn('Unauthorized photo access attempt', { photoId, userId });
      throw new Error('Unauthorized: You do not own this photo');
    }

    return photo;
  },

  /**
   * Verify photo belongs to specified log and user owns it
   * Returns the photo with grow log and grow relationships loaded
   */
  async verifyPhotoOwnership(userId: string, photoId: string, logId: string): Promise<{
    photo: GrowLogPhoto;
    isOwner: boolean;
    belongsToLog: boolean;
  }> {
    const photo = await GrowLogPhoto.findOne({
      where: { id: photoId },
      include: [
        {
          model: GrowLog,
          as: 'growLog',
          include: [
            {
              model: Grow,
              as: 'grow',
              attributes: ['id', 'user_id'],
            },
          ],
        },
      ],
    });

    if (!photo) {
      throw new Error('Photo not found');
    }

    const belongsToLog = photo.growLog?.id === logId;
    const isOwner = photo.growLog?.grow?.user_id === userId;

    return {
      photo,
      isOwner,
      belongsToLog,
    };
  },
};

export default GrowLogPhotoService;
