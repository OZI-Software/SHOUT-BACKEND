import * as dotenv from 'dotenv';
dotenv.config();

// Define a type for your configuration
interface Config {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  // ... other configuration variables
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'YOUR_SECURE_DEFAULT_SECRET', // **MUST be changed in .env**
};

export const { PORT, NODE_ENV, JWT_SECRET } = config;