import multer from 'multer';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/upload';

/**
 * File filter function for multer
 * Checks if uploaded file has an allowed MIME type
 */
const fileFilter: multer.Options['fileFilter'] = (req, file, callback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    );
  }
};

/**
 * Multer configuration with memory storage for pre-validation
 * Files are stored in memory (as Buffer) for validation before saving to disk
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

export default upload;
