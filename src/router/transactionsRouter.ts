import { Router } from "express";
import transactionsController from "../controllers/transactionsController";

const router = Router();

router.post("/createTransaction", transactionsController.createTransaction);
router.post("/createTransactionAlias", transactionsController.createTransactionAlias);
router.get("/allTransactions", transactionsController.getAllTransactions);
router.get("/transactions/:id", transactionsController.getTransactionsByUserId);

export default router;