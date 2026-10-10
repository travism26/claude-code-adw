'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, { DataTypes, Sequelize }) {
    // Create nutrients table
    await queryInterface.createTable('nutrients', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who created this nutrient (null for system/predefined nutrients)',
      },
      brand: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Brand name (e.g., General Hydroponics, Fox Farm)',
      },
      product_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Product name',
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'base',
        comment: 'Type: base, supplement, additive, ph_adjuster, other',
      },
      npk_ratio: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'NPK ratio (e.g., "3-1-2")',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Product description',
      },
      is_organic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is an organic nutrient',
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

    // Add CHECK constraint for type field
    await queryInterface.sequelize.query(`
      ALTER TABLE nutrients
      ADD CONSTRAINT check_nutrient_type
      CHECK (type IN ('base', 'supplement', 'additive', 'ph_adjuster', 'other'))
    `);

    // Add indexes for common queries
    await queryInterface.addIndex('nutrients', ['user_id']);
    await queryInterface.addIndex('nutrients', ['brand']);
    await queryInterface.addIndex('nutrients', ['type']);

    // Add unique constraint for system nutrients (brand + product_name)
    // This prevents duplicate predefined nutrients
    await queryInterface.addIndex('nutrients', ['brand', 'product_name'], {
      unique: true,
      name: 'idx_nutrients_brand_product_unique',
      where: {
        user_id: null,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nutrients');
  },
};
