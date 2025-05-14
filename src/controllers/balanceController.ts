import { Request, Response } from "express";
import { AppDataSource } from "../config/database";

const balanceController = {
    getBalances: async (req: Request, res: Response) => {
        const query = 'SELECT * FROM accounts';
        const result = await AppDataSource.query(query);
        return res.json(result);
    },
    getBalanceById: async (req: Request, res: Response) => {
        const { id } = req.params;
        const query = 'SELECT * FROM accounts WHERE id = $1';
        const result = await AppDataSource.query(query, [id]);
        return res.json(result);
    }
}

export default balanceController;