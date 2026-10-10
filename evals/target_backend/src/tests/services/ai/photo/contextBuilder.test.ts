import { expect } from 'chai';
import * as sinon from 'sinon';
import { GrowPhotoContextBuilder } from '../../../../services/ai/photo/GrowPhotoContextBuilder';
import { GrowLogPhoto } from '../../../../models/GrowLogPhoto';
import { ImageConversionService } from '../../../../services/ImageConversionService';

describe('GrowPhotoContextBuilder', () => {
  let findByPkStub: sinon.SinonStub;
  let processImageStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub database queries
    findByPkStub = sinon.stub(GrowLogPhoto, 'findByPk');
    processImageStub = sinon.stub(ImageConversionService, 'processImageForVisionAPI');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('build()', () => {
    it('should build complete context with all required fields', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';
      const mockPhaseStartedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        caption: 'Test plant photo',
        width: 1920,
        height: 1080,
        growLog: {
          id: 'log-789',
          notes: 'Looking healthy',
          logged_at: new Date(),
          environment: {
            temperature_f: 75,
            humidity_percent: 60,
            ph: 6.5,
            ec: 1.2,
            light_hours: 18,
          },
          grow: {
            id: 'grow-321',
            phase: 'vegetative',
            phase_started_at: mockPhaseStartedAt,
            grow_method: 'hydro',
            strain_name: 'Blue Dream',
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({
        base64: 'base64encodedimage',
        mimeType: 'image/jpeg',
      });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(result).to.be.an('object');
      expect(result.photoId).to.equal(photoId);
      expect(result.filePath).to.equal('/path/to/photo.jpg');
      expect(result.mimeType).to.equal('image/jpeg');
      expect(result.caption).to.equal('Test plant photo');
      expect(result.dimensions).to.deep.equal({ width: 1920, height: 1080 });
      expect(result.imageBase64).to.equal('base64encodedimage');

      // Verify grow log context
      expect(result.growLog).to.exist;
      expect(result.growLog!.id).to.equal('log-789');
      expect(result.growLog!.notes).to.equal('Looking healthy');
      expect(result.growLog!.environment).to.exist;
      expect(result.growLog!.environment!.temperature).to.equal(75);
      expect(result.growLog!.environment!.humidity).to.equal(60);
      expect(result.growLog!.environment!.ph).to.equal(6.5);
      expect(result.growLog!.environment!.ec).to.equal(1.2);
      expect(result.growLog!.environment!.lightHours).to.equal(18);

      // Verify grow context
      expect(result.grow).to.exist;
      expect(result.grow!.id).to.equal('grow-321');
      expect(result.grow!.phase).to.equal('vegetative');
      expect(result.grow!.daysInPhase).to.be.at.least(29);
      expect(result.grow!.method).to.equal('hydro');
      expect(result.grow!.strain).to.equal('Blue Dream');
    });

    it('should load photo from disk and convert to base64', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';
      const filePath = '/uploads/photos/test.jpg';

      const mockPhoto = {
        id: photoId,
        file_path: filePath,
        mime_type: 'image/jpeg',
        width: 1920,
        height: 1080,
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'flowering',
            phase_started_at: new Date(),
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({
        base64: 'base64encodedimage',
        mimeType: 'image/jpeg',
      });

      // Act
      await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(processImageStub.calledOnce).to.be.true;
      expect(processImageStub.firstCall.args[0]).to.equal(filePath);
    });

    it('should resize image to 1024x1024 before encoding', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/large-photo.jpg',
        mime_type: 'image/jpeg',
        width: 4096,
        height: 4096,
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'vegetative',
            phase_started_at: new Date(),
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({
        base64: 'base64encodedresizedimage',
        mimeType: 'image/jpeg',
      });

      // Act
      await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert - verify image was resized to 1024x1024
      expect(processImageStub.calledOnce).to.be.true;
      expect(processImageStub.firstCall.args[1]).to.equal(1024);
      expect(processImageStub.firstCall.args[2]).to.equal(1024);
    });

    it('should include grow log environment data when available', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          environment: {
            temperature_f: 72,
            humidity_percent: 55,
            ph: 6.0,
            ec: 1.5,
          },
          grow: {
            id: 'grow-321',
            phase: 'flowering',
            phase_started_at: new Date(),
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(result.growLog!.environment).to.exist;
      expect(result.growLog!.environment!.temperature).to.equal(72);
      expect(result.growLog!.environment!.humidity).to.equal(55);
      expect(result.growLog!.environment!.ph).to.equal(6.0);
      expect(result.growLog!.environment!.ec).to.equal(1.5);
    });

    it('should include grow phase and method context', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'flowering',
            phase_started_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            grow_method: 'soil',
            strain_name: 'Northern Lights',
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(result.grow).to.exist;
      expect(result.grow!.phase).to.equal('flowering');
      expect(result.grow!.daysInPhase).to.be.at.least(13);
      expect(result.grow!.method).to.equal('soil');
      expect(result.grow!.strain).to.equal('Northern Lights');
    });

    it('should throw error for non-existent photo', async () => {
      // Arrange
      findByPkStub.resolves(null);

      // Act & Assert
      try {
        await GrowPhotoContextBuilder.build('fake-photo-id', 'user-456');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Photo not found');
      }
    });

    it('should throw error if user does not own grow (ownership verification)', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';
      const differentUserId = 'different-user-789';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'vegetative',
            phase_started_at: new Date(),
            owner: {
              id: differentUserId, // Different user owns this grow
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act & Assert
      try {
        await GrowPhotoContextBuilder.build(photoId, userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('User does not own this photo');
      }
    });

    it('should handle missing optional fields (notes, environment data)', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        caption: null,
        width: null,
        height: null,
        growLog: {
          id: 'log-789',
          notes: null,
          logged_at: new Date(),
          // No environment data
          grow: {
            id: 'grow-321',
            phase: 'germination',
            phase_started_at: null,
            grow_method: null,
            strain_name: null,
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert - should not have optional fields
      expect(result.caption).to.be.undefined;
      expect(result.dimensions).to.be.undefined;
      expect(result.growLog!.notes).to.be.undefined;
      expect(result.growLog!.environment).to.be.undefined;
      expect(result.grow!.method).to.be.undefined;
      expect(result.grow!.strain).to.be.undefined;
      expect(result.grow!.daysInPhase).to.equal(0);
    });

    it('should handle missing grow log association', async () => {
      // Arrange
      const mockPhoto = {
        id: 'photo-123',
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: null,
      } as any;

      findByPkStub.resolves(mockPhoto);

      // Act & Assert
      try {
        await GrowPhotoContextBuilder.build('photo-123', 'user-456');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Photo has no associated grow log');
      }
    });

    it('should handle missing grow association', async () => {
      // Arrange
      const mockPhoto = {
        id: 'photo-123',
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: null,
        },
      } as any;

      findByPkStub.resolves(mockPhoto);

      // Act & Assert
      try {
        await GrowPhotoContextBuilder.build('photo-123', 'user-456');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Grow log has no associated grow');
      }
    });

    it('should calculate days in phase correctly', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';
      const daysAgo = 45;
      const phaseStartedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'flowering',
            phase_started_at: phaseStartedAt,
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(result.grow!.daysInPhase).to.be.at.least(daysAgo - 1); // Allow for timing differences
      expect(result.grow!.daysInPhase).to.be.at.most(daysAgo + 1);
    });

    it('should return 0 days in phase when phase_started_at is null', async () => {
      // Arrange
      const photoId = 'photo-123';
      const userId = 'user-456';

      const mockPhoto = {
        id: photoId,
        file_path: '/path/to/photo.jpg',
        mime_type: 'image/jpeg',
        growLog: {
          id: 'log-789',
          logged_at: new Date(),
          grow: {
            id: 'grow-321',
            phase: 'germination',
            phase_started_at: null,
            owner: {
              id: userId,
            },
          },
        },
      } as any;

      findByPkStub.resolves(mockPhoto);
      processImageStub.resolves({ base64: 'base64', mimeType: 'image/jpeg' });

      // Act
      const result = await GrowPhotoContextBuilder.build(photoId, userId);

      // Assert
      expect(result.grow!.daysInPhase).to.equal(0);
    });
  });
});
