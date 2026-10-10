/**
 * Grow Photo Context Builder
 *
 * Gathers all necessary data for photo analysis:
 * - Photo metadata and file path
 * - Image data (loaded, resized, base64 encoded)
 * - Associated grow log information
 * - Grow context (phase, method, strain)
 */

import { GrowPhotoContext } from './types';
import { GrowLogPhoto } from '../../../models/GrowLogPhoto';
import { GrowLog } from '../../../models/GrowLog';
import { Grow } from '../../../models/Grow';
import { User } from '../../../models/User';
import { ImageConversionService } from '../../ImageConversionService';
import { logAI } from '../../logging/logger';

export class GrowPhotoContextBuilder {
  /**
   * Build complete context for photo analysis
   *
   * @param photoId - ID of the photo to analyze
   * @param userId - ID of the user requesting analysis (for ownership verification)
   * @returns Complete context object with photo data, grow log, and grow information
   * @throws Error if photo not found, user doesn't own the grow, or image processing fails
   */
  static async build(photoId: string, userId: string): Promise<GrowPhotoContext> {
    try {
      logAI.info('Building photo analysis context', {
        service: 'GrowPhotoContextBuilder',
        photoId,
        userId,
      });

      // Query photo with all associations
      const photo = await GrowLogPhoto.findByPk(photoId, {
        include: [
          {
            model: GrowLog,
            as: 'growLog',
            required: true,
            include: [
              {
                model: Grow,
                as: 'grow',
                required: true,
                include: [
                  {
                    model: User,
                    as: 'owner',
                    required: true,
                  },
                ],
              },
            ],
          },
        ],
      });

      // Validate photo exists
      if (!photo) {
        logAI.warn('Photo not found', {
          service: 'GrowPhotoContextBuilder',
          photoId,
        });
        throw new Error(`Photo not found: ${photoId}`);
      }

      // Validate ownership
      const growLog = photo.growLog;
      if (!growLog) {
        throw new Error('Photo has no associated grow log');
      }

      const grow = growLog.grow;
      if (!grow) {
        throw new Error('Grow log has no associated grow');
      }

      const owner = grow.owner;
      if (!owner || owner.id !== userId) {
        logAI.warn('Ownership verification failed', {
          service: 'GrowPhotoContextBuilder',
          photoId,
          requestingUserId: userId,
          ownerId: owner?.id,
        });
        throw new Error('User does not own this photo');
      }

      logAI.debug('Photo and ownership validated', {
        service: 'GrowPhotoContextBuilder',
        photoId,
        growLogId: growLog.id,
        growId: grow.id,
        userId,
      });

      // Load and process image
      const { base64, mimeType } = await ImageConversionService.processImageForVisionAPI(
        photo.file_path,
        1024,
        1024
      );

      logAI.debug('Image processed for vision API', {
        service: 'GrowPhotoContextBuilder',
        photoId,
        filePath: photo.file_path,
        base64Length: base64.length,
        mimeType,
      });

      // Calculate days in current phase
      const daysInPhase = this.calculateDaysInPhase(grow.phase_started_at);

      // Build context object
      const context: GrowPhotoContext = {
        // Photo metadata
        photoId: photo.id,
        filePath: photo.file_path,
        mimeType: photo.mime_type,
        caption: photo.caption || undefined,
        dimensions: photo.width && photo.height
          ? { width: photo.width, height: photo.height }
          : undefined,

        // Image data
        imageBase64: base64,

        // Grow log context
        growLog: {
          id: growLog.id,
          notes: growLog.notes || undefined,
          loggedAt: growLog.logged_at,
          environment: (growLog as any).environment ? {
            temperature: (growLog as any).environment.temperature_f || undefined,
            humidity: (growLog as any).environment.humidity_percent || undefined,
            ph: (growLog as any).environment.ph || undefined,
            ec: (growLog as any).environment.ec || undefined,
            lightHours: (growLog as any).environment.light_hours || undefined,
          } : undefined,
        },

        // Grow context
        grow: {
          id: grow.id,
          phase: grow.phase,
          daysInPhase,
          method: grow.grow_method || undefined,
          strain: grow.strain_name || undefined,
        },
      };

      logAI.info('Photo analysis context built successfully', {
        service: 'GrowPhotoContextBuilder',
        photoId,
        growLogId: context.growLog?.id,
        growId: context.grow?.id,
        phase: context.grow?.phase,
        daysInPhase: context.grow?.daysInPhase,
        hasEnvironmentData: !!(context.growLog?.environment && Object.keys(context.growLog.environment).length > 0),
      });

      return context;
    } catch (error) {
      logAI.error('Failed to build photo analysis context', {
        service: 'GrowPhotoContextBuilder',
        photoId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Calculate days in current phase
   * @param phaseStartedAt - Date when current phase started
   * @returns Number of days in current phase
   */
  private static calculateDaysInPhase(phaseStartedAt: Date | null): number {
    if (!phaseStartedAt) {
      return 0;
    }

    const now = new Date();
    const diffMs = now.getTime() - phaseStartedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}
