import { Request, Response } from "express";

const indexController = {
    index: async (_: Request, res: Response) => {
        res.send("INDEX IDDO");
    }
}       

export default indexController;