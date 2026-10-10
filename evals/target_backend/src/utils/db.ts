interface DbCredentials {
  username: string;
  password: string;
}

export async function getDbCredentials(): Promise<DbCredentials> {
  console.log('=== Environment Variables Debug ===');
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'not set');
  console.log('===================================');

  // Use environment variables for database credentials
  const credentials: DbCredentials = {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  console.log('Using credentials from environment variables');
  console.log('Username:', credentials.username);

  return credentials;
}
