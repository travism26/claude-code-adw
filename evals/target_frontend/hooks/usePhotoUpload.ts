import { useState, useCallback, useEffect } from "react";
import type { GrowLogPhoto } from "../types";

/**
 * Interface for photo with preview
 */
export interface PhotoWithPreview {
  file: File;
  preview: string;
  caption: string;
}

interface UsePhotoUploadOptions {
  existingPhotos?: GrowLogPhoto[];
  maxPhotos?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}

/**
 * Custom hook for handling photo upload logic
 * Includes validation, file selection, drag-and-drop, and preview management
 */
export function usePhotoUpload({
  existingPhotos = [],
  maxPhotos = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes = ["image/jpeg", "image/png", "image/webp"],
}: UsePhotoUploadOptions = {}) {
  const [photos, setPhotos] = useState<PhotoWithPreview[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);

  /**
   * Validate photo file
   */
  const validatePhoto = useCallback(
    (file: File): string | null => {
      if (!allowedFileTypes.includes(file.type)) {
        return `${file.name}: Invalid file type. Only JPEG, PNG, and WebP are allowed.`;
      }
      if (file.size > maxFileSize) {
        return `${file.name}: File too large. Maximum size is 10MB.`;
      }
      if (photos.length + existingPhotos.length >= maxPhotos) {
        return `Maximum of ${maxPhotos} photos per log entry.`;
      }
      return null;
    },
    [photos.length, existingPhotos.length, maxPhotos, maxFileSize, allowedFileTypes]
  );

  /**
   * Handle file selection from input or drag-and-drop
   */
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newPhotoErrors: string[] = [];
      const newPhotos: PhotoWithPreview[] = [];

      Array.from(files).forEach((file) => {
        const error = validatePhoto(file);
        if (error) {
          newPhotoErrors.push(error);
        } else {
          newPhotos.push({
            file,
            preview: URL.createObjectURL(file),
            caption: "",
          });
        }
      });

      setPhotoErrors(newPhotoErrors);
      setPhotos((prev) => [...prev, ...newPhotos]);
    },
    [validatePhoto]
  );

  /**
   * Remove photo from upload list
   */
  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const newPhotos = [...prev];
      // Clean up object URL
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  }, []);

  /**
   * Update photo caption
   */
  const handleCaptionChange = useCallback(
    (index: number, caption: string) => {
      setPhotos((prev) => {
        const newPhotos = [...prev];
        newPhotos[index].caption = caption;
        return newPhotos;
      });
    },
    []
  );

  /**
   * Handle drag-and-drop
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  /**
   * Clean up object URLs on unmount
   */
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, [photos]);

  return {
    photos,
    photoErrors,
    handleFileSelect,
    handleRemovePhoto,
    handleCaptionChange,
    handleDragOver,
    handleDrop,
  };
}
