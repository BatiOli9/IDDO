import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Configuración de variables de entorno
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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