import { Router } from "express";
import balanceController from "../controllers/balanceController";

const router = Router();

router.get("/", balanceController.getBalances);
router.get("/:id", balanceController.getBalanceById);

export default router;