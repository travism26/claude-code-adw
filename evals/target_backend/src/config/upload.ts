import path from 'path';

// Upload configuration constants
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads/grows';

export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE || '200', 10);

// Get absolute upload directory path
export const getUploadDir = (): string => {
  return path.isAbsolute(UPLOAD_DIR)
    ? UPLOAD_DIR
    : path.join(process.cwd(), UPLOAD_DIR);
};
