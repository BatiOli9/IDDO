import { Router } from 'express';
import { validateCVU } from '../middlewares/validateCVU';

const router = Router();

router.post('/validate-cvu', validateCVU, (req, res) => {
    // Si llegamos aquí, significa que el CVU es válido
    res.json({ 
        message: 'CVU válido', 
        cvu: req.body.cvu 
    });
});

export default router; 