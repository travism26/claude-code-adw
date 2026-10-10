'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create grow_log_photos table
    await queryInterface.createTable('grow_log_photos', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      grow_log_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'grow_logs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Grow log entry this photo belongs to',
      },
      file_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Path to the photo file on disk',
      },
      thumbnail_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Path to the thumbnail file on disk',
      },
      original_filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Original filename as uploaded by user',
      },
      mime_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'MIME type of the image file',
      },
      file_size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'File size in bytes',
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Image width in pixels',
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Image height in pixels',
      },
      caption: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Optional caption for the photo',
      },
      is_cover: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this photo is the cover photo for the log entry',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add CHECK constraint for mime_type field
    await queryInterface.sequelize.query(`
      ALTER TABLE grow_log_photos
      ADD CONSTRAINT check_grow_log_photo_mime_type
      CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
    `);

    // Add CHECK constraint for file_size_bytes
    await queryInterface.sequelize.query(`
      ALTER TABLE grow_log_photos
      ADD CONSTRAINT check_grow_log_photo_file_size
      CHECK (file_size_bytes >= 0)
    `);

    // Add indexes for common queries
    await queryInterface.addIndex('grow_log_photos', ['grow_log_id']);
    await queryInterface.addIndex('grow_log_photos', ['is_cover']);

    // Add composite index for grow_log_id + created_at (for chronological queries)
    await queryInterface.addIndex('grow_log_photos', ['grow_log_id', 'created_at'], {
      name: 'idx_grow_log_photos_log_time',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grow_log_photos');
  },
};
