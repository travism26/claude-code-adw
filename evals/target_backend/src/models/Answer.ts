import { Model, DataTypes, Sequelize } from 'sequelize';

export class Answer extends Model {
  declare id: string;
  declare question_id: string;
  declare user_id: string;
  declare body: string;
  declare upvotes: number;
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Answer.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        question_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            len: {
              args: [1, 2000],
              msg: 'Answer body must be between 1 and 2000 characters',
            },
          },
        },
        upvotes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Upvotes cannot be negative',
            },
          },
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'answers',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );
  }
}
