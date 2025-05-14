import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { AppDataSource } from './config/database';

// Configuración de variables de entorno
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  origin: "*", // Cambia esto a un dominio específico en producción
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

// Ruta de prueba
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'IDDO FUNCIONANDO CORRECTAMENTE' });
});

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).send('Lo siento, no se encontró la página solicitada. ERROR 404'); 
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`⚡️[servidor]: Servidor corriendo en http://localhost:${port}`);
}); 