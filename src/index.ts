import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { AppDataSource } from './config/database';
import transactionsRouter from './router/transactionsRouter';
import balanceRouter from './router/balanceRouter';
import indexRouter from './router/indexRouter';

dotenv.config();

const app: Express = express();

// Middleware
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS", "DELETE", "PUT"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar la base de datos
AppDataSource.initialize()
    .then(() => {
        console.log("Base de datos conectada exitosamente");
    })
    .catch((error) => console.log("Error al conectar con la base de datos:", error));

// Rutas
app.use('/', indexRouter);
app.use('/transactions', transactionsRouter);
app.use('/balance', balanceRouter);

// Ruta de prueba
app.get('/', (_: Request, res: Response) => {
  res.json({ message: 'IDDO FUNCIONANDO CORRECTAMENTE' });
});

// @ts-ignore
app.use((_: Request, res: Response, next: NextFunction) => {
    res.status(404).send('Lo siento, no se encontró la página solicitada. ERROR 404'); 
});

// NO USAR app.listen EN VERCEL
export default app;