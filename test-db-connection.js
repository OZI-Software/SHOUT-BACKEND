import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

console.log('Testing connection to:', connectionString ? connectionString.replace(/:[^:@]*@/, ':****@') : 'undefined');

const client = new Client({
    connectionString,
});

async function testConnection() {
    try {
        await client.connect();
        console.log('Successfully connected to the database!');
        const res = await client.query('SELECT NOW()');
        console.log('Current time from DB:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Connection error:', err);
    }
}

testConnection();
