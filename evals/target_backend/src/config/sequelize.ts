import { Sequelize } from 'sequelize';
import { getDbCredentials } from '../utils/db';

let sequelizeInstance: Sequelize | null = null;

export async function getSequelize(): Promise<Sequelize> {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  const credentials = await getDbCredentials();

  sequelizeInstance = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || credentials.username || 'postgres',
    password: process.env.DB_PASSWORD || credentials.password || 'postgres',
    database: process.env.DB_NAME || 'growbuddy',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });

  return sequelizeInstance;
}

// For backward compatibility
export default {
  getSequelize,
};
