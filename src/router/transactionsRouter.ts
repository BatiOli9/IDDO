import { Router } from "express";
import transactionsController from "../controllers/transactionsController";

const router = Router();

router.post("/createTransaction", transactionsController.createTransaction);

export default router;