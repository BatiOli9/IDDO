import { Request, Response } from "express";
import { AppDataSource } from "../config/database";
import { voucherService } from "../services/voucherService";
import { sendParentNotification, sendLimitExceededNotification } from '../services/emailService';

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

    // Nueva función para obtener información del usuario
    async getUserInfo(user_id: number): Promise<any> {
        try {
            const query = 'SELECT * FROM users WHERE id = $1';
            const result = await AppDataSource.query(query, [user_id]);
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error al obtener información del usuario:', error);
            throw error;
        }
    },

    // Nueva función para validar límite de transferencia
    async validateTransferLimit(user_id: number, amount: number): Promise<{ valid: boolean; message?: string }> {
        try {
            const userInfo = await transactionsController.getUserInfo(user_id);
            
            if (!userInfo) {
                return { valid: false, message: 'Usuario no encontrado' };
            }

            // Si es un adulto (hierarchy = false), no hay límite
            if (!userInfo.hierarchy) {
                return { valid: true };
            }

            // Si es un menor (hierarchy = true) pero no tiene límite configurado
            if (!userInfo.limit) {
                return { 
                    valid: false, 
                    message: 'No se encontró un límite configurado para el usuario menor'
                };
            }

            if (Number(amount) > Number(userInfo.limit)) {
                return { 
                    valid: false, 
                    message: `El monto excede el límite permitido de ${userInfo.limit}`
                };
            }

            return { valid: true };
        } catch (error) {
            console.error('Error al validar límite de transferencia:', error);
            throw error;
        }
    },

    // Nueva función para calcular el total transferido en el día por un usuario
    async getTotalTransferredToday(user_id: number): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const query = `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE sender_id = $1 AND created_at >= $2 AND created_at < $3`;
        const result = await AppDataSource.query(query, [user_id, today, tomorrow]);
        return Number(result[0].total);
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

            // Obtener información de los usuarios para validaciones y mails
            const senderInfo = await transactionsController.getUserInfo(sender_id);
            const receiverInfo = await transactionsController.getUserInfo(receiver_id);

            // Validar límite de transferencia para usuarios menores
            const limitValidation = await transactionsController.validateTransferLimit(sender_id, amount);
            if (!limitValidation.valid) {
                // Si es menor y supera el límite, notificar al padre
                if (senderInfo.hierarchy) {
                    const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                    if (parentResult.length > 0) {
                        const parentId = parentResult[0].parent_id;
                        const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                        if (parentUser.length > 0) {
                            const parentEmail = parentUser[0].email;
                            await sendLimitExceededNotification({
                                parentEmail,
                                childName: senderInfo.name,
                                amount: Number(amount),
                                limit: senderInfo.limit,
                                receiverName: receiverInfo ? receiverInfo.name : '',
                                date: new Date()
                            });
                        }
                    }
                }
                return res.status(400).json({
                    error: limitValidation.message
                });
            }

            // Validar límite diario para menores
            if (senderInfo.hierarchy && senderInfo.limit_day) {
                const totalHoy = await transactionsController.getTotalTransferredToday(sender_id);
                if (totalHoy + Number(amount) > Number(senderInfo.limit_day)) {
                    // Notificar al padre
                    const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                    if (parentResult.length > 0) {
                        const parentId = parentResult[0].parent_id;
                        const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                        if (parentUser.length > 0) {
                            const parentEmail = parentUser[0].email;
                            await sendLimitExceededNotification({
                                parentEmail,
                                childName: senderInfo.name,
                                amount: Number(amount),
                                limit: senderInfo.limit_day,
                                receiverName: receiverInfo ? receiverInfo.name : '',
                                date: new Date()
                            });
                        }
                    }
                    return res.status(400).json({
                        error: `El monto excede el límite diario permitido de ${senderInfo.limit_day}`
                    });
                }
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

            // Registrar transacción con sender_id y receiver_id
            const query = 'INSERT INTO transactions (amount, sender_id, receiver_id) VALUES ($1, $2, $3) RETURNING *';
            const result = await AppDataSource.query(query, [amount, sender_id, receiver_id]);
            
            // Generar y subir el voucher
            const voucherUrl = await voucherService.generateAndUploadVoucher({
                transactionId: result[0].id,
                amount: Number(amount),
                senderName: senderInfo.name,
                senderCVU: senderInfo.cvu,
                senderDNI: senderInfo.dni,
                receiverName: receiverInfo.name,
                receiverCVU: receiverInfo.cvu,
                receiverDNI: receiverInfo.dni,
                date: new Date()
            });

            // Actualizar la transacción con la URL del voucher
            await AppDataSource.query(
                'UPDATE transactions SET voucher = $1 WHERE id = $2',
                [voucherUrl, result[0].id]
            );
            
            // Después de registrar la transacción y generar el voucher
            // Notificar al padre si el usuario es menor
            if (senderInfo.hierarchy) {
                // Buscar el parent_id en la tabla parents
                const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                if (parentResult.length > 0) {
                    const parentId = parentResult[0].parent_id;
                    // Buscar el email del padre
                    const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                    if (parentUser.length > 0) {
                        const parentEmail = parentUser[0].email;
                        await sendParentNotification({
                            parentEmail,
                            childName: senderInfo.name,
                            amount: Number(amount),
                            receiverName: receiverInfo.name,
                            date: new Date()
                        });
                    }
                }
            }

            return res.status(201).json({
                message: 'Transacción creada exitosamente',
                transaction: {
                    ...result[0],
                    voucher_url: voucherUrl
                }
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
        const sender_id = 3; // Este valor debería venir de la autenticación del usuario

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

            // Obtener información de los usuarios para validaciones y mails
            const senderInfo = await transactionsController.getUserInfo(sender_id);
            const receiverInfo = await transactionsController.getUserInfo(receiver_id);

            // Validar límite de transferencia para usuarios menores
            const limitValidation = await transactionsController.validateTransferLimit(sender_id, amount);
            if (!limitValidation.valid) {
                // Si es menor y supera el límite, notificar al padre
                if (senderInfo.hierarchy) {
                    const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                    if (parentResult.length > 0) {
                        const parentId = parentResult[0].parent_id;
                        const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                        if (parentUser.length > 0) {
                            const parentEmail = parentUser[0].email;
                            await sendLimitExceededNotification({
                                parentEmail,
                                childName: senderInfo.name,
                                amount: Number(amount),
                                limit: senderInfo.limit,
                                receiverName: receiverInfo ? receiverInfo.name : '',
                                date: new Date()
                            });
                        }
                    }
                }
                return res.status(400).json({
                    error: limitValidation.message
                });
            }

            // Validar límite diario para menores
            if (senderInfo.hierarchy && senderInfo.limit_day) {
                const totalHoy = await transactionsController.getTotalTransferredToday(sender_id);
                if (totalHoy + Number(amount) > Number(senderInfo.limit_day)) {
                    // Notificar al padre
                    const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                    if (parentResult.length > 0) {
                        const parentId = parentResult[0].parent_id;
                        const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                        if (parentUser.length > 0) {
                            const parentEmail = parentUser[0].email;
                            await sendLimitExceededNotification({
                                parentEmail,
                                childName: senderInfo.name,
                                amount: Number(amount),
                                limit: senderInfo.limit_day,
                                receiverName: receiverInfo ? receiverInfo.name : '',
                                date: new Date()
                            });
                        }
                    }
                    return res.status(400).json({
                        error: `El monto excede el límite diario permitido de ${senderInfo.limit_day}`
                    });
                }
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

            // Registrar transacción con sender_id y receiver_id
            const query = 'INSERT INTO transactions (amount, sender_id, receiver_id) VALUES ($1, $2, $3) RETURNING *';
            const result = await AppDataSource.query(query, [amount, sender_id, receiver_id]);
            
            // Generar y subir el voucher
            const voucherUrl = await voucherService.generateAndUploadVoucher({
                transactionId: result[0].id,
                amount: Number(amount),
                senderName: senderInfo.name,
                senderCVU: senderInfo.cvu,
                senderDNI: senderInfo.dni,
                receiverName: receiverInfo.name,
                receiverCVU: receiverInfo.cvu,
                receiverDNI: receiverInfo.dni,
                date: new Date()
            });

            // Actualizar la transacción con la URL del voucher
            await AppDataSource.query(
                'UPDATE transactions SET voucher = $1 WHERE id = $2',
                [voucherUrl, result[0].id]
            );
            
            // Después de registrar la transacción y generar el voucher
            // Notificar al padre si el usuario es menor
            if (senderInfo.hierarchy) {
                // Buscar el parent_id en la tabla parents
                const parentResult = await AppDataSource.query('SELECT parent_id FROM parents WHERE child_id = $1', [sender_id]);
                if (parentResult.length > 0) {
                    const parentId = parentResult[0].parent_id;
                    // Buscar el email del padre
                    const parentUser = await AppDataSource.query('SELECT email FROM users WHERE id = $1', [parentId]);
                    if (parentUser.length > 0) {
                        const parentEmail = parentUser[0].email;
                        await sendParentNotification({
                            parentEmail,
                            childName: senderInfo.name,
                            amount: Number(amount),
                            receiverName: receiverInfo.name,
                            date: new Date()
                        });
                    }
                }
            }

            return res.status(201).json({
                message: 'Transacción creada exitosamente',
                transaction: {
                    ...result[0],
                    voucher_url: voucherUrl
                }
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