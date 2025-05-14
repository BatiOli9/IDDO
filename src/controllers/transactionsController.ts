import { Request, Response } from "express";
import { AppDataSource } from "../config/database";

const transactionsController = {
    createTransaction: async (req: Request, res: Response) => {
        const { amount, cvu } = req.body;

        // Validar que los campos requeridos existan
        if (!amount || !cvu) {
            return res.status(400).json({
                error: 'El monto y el CVU son requeridos'
            });
        }

        // Validar formato del CVU
        if (!/^\d{22}$/.test(cvu.toString())) {
            return res.status(400).json({ 
                error: 'El CVU debe contener exactamente 22 dígitos numéricos',
                received: cvu,
                length: cvu.toString().length
            });
        }

        // Validar el monto
        if (!Number(amount) || Number(amount) <= 0) {
            return res.status(400).json({ 
                error: 'El monto debe ser un número mayor que 0'
            });
        }

        // Procesar la transacción
        try {
            const sender_id = 1; // Este valor debería venir de la autenticación del usuario
            const query = 'INSERT INTO transactions (amount, receiver_cvu, sender_id) VALUES ($1, $2, $3) RETURNING *';
            const result = await AppDataSource.query(query, [amount, cvu, sender_id]);
            
            return res.status(201).json({
                message: 'Transacción creada exitosamente',
                transaction: result[0]
            });
        } catch (error) {
            console.error('Error al crear la transacción:', error);
            return res.status(500).json({
                error: 'Error al procesar la transacción'
            });
        }
    }
};

export default transactionsController;