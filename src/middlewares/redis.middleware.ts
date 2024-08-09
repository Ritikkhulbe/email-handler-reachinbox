import Redis from 'ioredis';
import dotenv from 'dotenv';
import {redisOptions} from '../constants';

dotenv.config();

export const connection = new Redis(redisOptions);

export const redisGetToken = async (email: string): Promise<string | null> => {
  try {
    const token = await connection.get(email);
    return token;
  } catch (error) {
    console.error(`Error retrieving token from Redis for email ${email}:`, (error as Error).message);
    throw new Error(`Error retrieving token from Redis for email ${email}.`);
  }
};


