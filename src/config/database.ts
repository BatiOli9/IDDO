import { DataSource } from "typeorm";
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.nnvpqypojkfrhgsrupri:RutlN5X3s3fKQBOA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    synchronize: process.env.NODE_ENV === "development", // Solo en desarrollo
    logging: process.env.NODE_ENV === "development",
    entities: ["src/models/**/*.ts"],
    migrations: ["src/migrations/**/*.ts"],
    subscribers: ["src/subscribers/**/*.ts"],
}); 