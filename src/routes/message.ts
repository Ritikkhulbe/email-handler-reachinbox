import express, { Request, Response } from 'express';
import { getDrafts, readMail, getMails, createLabel, getLabel } from '../controllers/messageController';
import { sendMailViaQueue, sendMultipleEmails } from '../controllers/queueController';
import { redisGetToken } from '../middlewares/redis.middleware';
import { sendMail, getUser } from './googleauth';

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.get("/userInfo/:email", getUser);

router.post("/sendMail/:email", async (req: Request, res: Response) => {
  try {
    const token = await redisGetToken(req.params.email);
    if(!token) throw new Error;

    const result = await sendMail(req.body, token);
    res.status(200).json({ message: "Email sent successfully", result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/allDrafts/:email", getDrafts);
router.get("/read/:email/message/:message", readMail);
router.get("/list/:email", getMails);

router.post("/sendone/:email/:id", sendMailViaQueue);
router.post("/sendMultiple/:id", sendMultipleEmails);
router.post("/createLabel/:email", createLabel);
router.get("/getLabel/:email/:id", getLabel);

export default router;
