import { Request, Response } from "express";
import { AppDataSource } from "../config/database";

const transactionsController = {
    // Función para verificar si existe el CVU
    async checkCVUExists(cvu: string): Promise<boolean> {
        try {
            const query = 'SELECT COUNT(*) as count FROM users WHERE cvu = $1';
            const result = await AppDataSource.query(query, [cvu]);
            return result[0].count > 0;
        } catch (error) {
            console.error('Error al verificar CVU:', error);
            throw error;
        }
    },

    // Función para obtener el ID del usuario por su CVU
    async getUserIdByCVU(cvu: string): Promise<number | null> {
        try {
            const query = 'SELECT id::integer as id FROM users WHERE cvu = $1';
            const result = await AppDataSource.query(query, [cvu]);
            return result.length > 0 ? parseInt(result[0].id) : null;
        } catch (error) {
            console.error('Error al obtener usuario por CVU:', error);
            throw error;
        }
    },

    // Nueva función para obtener CVU por alias
    async getCVUByAlias(alias: string): Promise<string | null> {
        try {
            const query = 'SELECT cvu FROM users WHERE alias = $1';
            const result = await AppDataSource.query(query, [alias.toLowerCase()]);
            return result.length > 0 ? result[0].cvu : null;
        } catch (error) {
            console.error('Error al obtener CVU por alias:', error);
            throw error;
        }
    },

    async getAccountByUserId(user_id: number): Promise<any> {
        const query = 'SELECT * FROM accounts WHERE user_id = $1';
        const result = await AppDataSource.query(query, [user_id]);
        return result.length > 0 ? result[0] : null;
    },

    async updateAccountBalance(user_id: number, newBalance: number): Promise<void> {
        const query = 'UPDATE accounts SET balance = $1 WHERE user_id = $2';
        await AppDataSource.query(query, [newBalance, user_id]);
    },

    createTransaction: async (req: Request, res: Response) => {
        const { amount, cvu } = req.body;
        const sender_id = 1; // Este valor debería venir de la autenticación del usuario

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

        try {
            // Verificar si el CVU existe en la base de datos
            const cvuExists = await transactionsController.checkCVUExists(cvu.toString());
            if (!cvuExists) {
                return res.status(404).json({
                    error: 'El CVU ingresado no corresponde a ningún usuario registrado'
                });
            }

            // Obtener el ID del receptor y verificar que no sea el mismo que el remitente
            const receiver_id = await transactionsController.getUserIdByCVU(cvu.toString());
            
            if (!receiver_id) {
                return res.status(404).json({
                    error: 'No se pudo obtener el ID del receptor'
                });
            }

            if (receiver_id === sender_id) {
                return res.status(400).json({
                    error: 'No puedes realizar una transferencia a tu propia cuenta'
                });
            }

            // Obtener cuentas
            const senderAccount = await transactionsController.getAccountByUserId(sender_id);
            const receiverAccount = await transactionsController.getAccountByUserId(receiver_id);
            if (!senderAccount || !receiverAccount) {
                return res.status(404).json({ error: 'No se encontró la cuenta de origen o destino' });
            }

            // Verificar saldo suficiente
            if (Number(senderAccount.balance) < Number(amount)) {
                return res.status(400).json({ error: 'Saldo insuficiente para realizar la transferencia' });
            }

            // Actualizar saldos
            await transactionsController.updateAccountBalance(sender_id, Number(senderAccount.balance) - Number(amount));
            await transactionsController.updateAccountBalance(receiver_id, Number(receiverAccount.balance) + Number(amount));

            // Registrar transacción
            const query = 'INSERT INTO transactions (amount, receiver_cvu, sender_id) VALUES ($1, $2, $3) RETURNING *';
            const result = await AppDataSource.query(query, [amount, cvu, sender_id]);
            
            return res.status(201).json({
                message: 'Transacción creada exitosamente',
                transaction: result[0]
            });
        } catch (error) {
            console.error('Error al procesar la transacción:', error);
            return res.status(500).json({
                error: 'Error al procesar la transacción'
            });
        }
    },

    createTransactionAlias: async (req: Request, res: Response) => {
        const { amount, alias } = req.body;
        const sender_id = 1; // Este valor debería venir de la autenticación del usuario

        // Validar que los campos requeridos existan
        if (!amount || !alias) {
            return res.status(400).json({
                error: 'El monto y el alias son requeridos'
            });
        }

        // Validar el monto
        if (!Number(amount) || Number(amount) <= 0) {
            return res.status(400).json({ 
                error: 'El monto debe ser un número mayor que 0'
            });
        }

        try {
            // Obtener el CVU correspondiente al alias
            const cvu = await transactionsController.getCVUByAlias(alias);
            
            if (!cvu) {
                return res.status(404).json({
                    error: 'No se encontró ningún usuario con el alias proporcionado'
                });
            }

            // Obtener el ID del receptor y verificar que no sea el mismo que el remitente
            const receiver_id = await transactionsController.getUserIdByCVU(cvu);
            
            if (!receiver_id) {
                return res.status(404).json({
                    error: 'No se pudo obtener el ID del receptor'
                });
            }

            if (receiver_id === sender_id) {
                return res.status(400).json({
                    error: 'No puedes realizar una transferencia a tu propia cuenta'
                });
            }

            // Obtener cuentas
            const senderAccount = await transactionsController.getAccountByUserId(sender_id);
            const receiverAccount = await transactionsController.getAccountByUserId(receiver_id);
            if (!senderAccount || !receiverAccount) {
                return res.status(404).json({ error: 'No se encontró la cuenta de origen o destino' });
            }

            // Verificar saldo suficiente
            if (Number(senderAccount.balance) < Number(amount)) {
                return res.status(400).json({ error: 'Saldo insuficiente para realizar la transferencia' });
            }

            // Actualizar saldos
            await transactionsController.updateAccountBalance(sender_id, Number(senderAccount.balance) - Number(amount));
            await transactionsController.updateAccountBalance(receiver_id, Number(receiverAccount.balance) + Number(amount));

            // Registrar transacción
            const query = 'INSERT INTO transactions (amount, receiver_cvu, sender_id) VALUES ($1, $2, $3) RETURNING *';
            const result = await AppDataSource.query(query, [amount, cvu, sender_id]);
            
            return res.status(201).json({
                message: 'Transacción creada exitosamente',
                transaction: result[0]
            });
        } catch (error) {
            console.error('Error al procesar la transacción:', error);
            return res.status(500).json({
                error: 'Error al procesar la transacción'
            });
        }
    },

    getAllTransactions: async (req: Request, res: Response) => {
        const transactions = await AppDataSource.query('SELECT * FROM transactions');
        res.json(transactions);
    },

    getTransactionsByUserId: async (req: Request, res: Response) => {
        const { id } = req.params;
        const transactions = await AppDataSource.query('SELECT * FROM transactions WHERE sender_id = $1', [id]);
        res.json(transactions);
    },
};

export default transactionsController;