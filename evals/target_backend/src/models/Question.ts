import { Model, DataTypes, Sequelize } from "sequelize";

export class Question extends Model {
  declare id: string;
  declare user_id: string;
  declare title: string;
  declare body: string;
  declare tags: string[];
  declare created_at: Date;
  declare updated_at: Date;

  static initSchema(sequelize: Sequelize) {
    Question.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          // references: {
          //   model: 'users',
          //   key: 'id',
          // },
          // onUpdate: 'CASCADE',
          // onDelete: 'CASCADE',
        },
        title: {
          type: DataTypes.STRING(200),
          allowNull: false,
          validate: {
            len: {
              args: [1, 200],
              msg: "Title must be between 1 and 200 characters",
            },
          },
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: {
            len: {
              args: [1, 2000],
              msg: "Body must be between 1 and 2000 characters",
            },
          },
        },
        tags: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
          defaultValue: [],
          validate: {
            isValidTags(value: string[]) {
              if (value && value.length > 10) {
                throw new Error("Maximum of 10 tags allowed");
              }
              if (value) {
                for (const tag of value) {
                  if (tag.length > 50) {
                    throw new Error("Each tag must be 50 characters or less");
                  }
                }
              }
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
        tableName: "questions",
        underscored: true,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
  }
}
