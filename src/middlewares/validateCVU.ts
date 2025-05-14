import { Request, Response, NextFunction } from 'express';

export const validateCVU = (req: Request, res: Response, next: NextFunction) => {
    const { cvu } = req.body;

    // Verificar si el CVU existe
    if (!cvu) {
        return res.status(400).json({ error: 'El CVU es requerido' });
    }

    // Convertir a string en caso de que sea número
    const cvuString = cvu.toString();

    // Verificar que sea exactamente 22 dígitos y solo contenga números
    if (!/^\d{22}$/.test(cvuString)) {
        return res.status(400).json({ 
            error: 'El CVU debe contener exactamente 22 dígitos numéricos',
            received: cvuString,
            length: cvuString.length
        });
    }

    // Si pasa la validación, continuar
    next();
}; 