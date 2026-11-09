import express from "express";
import {
  startSession,
  processAnswer,
  generateReport
} from "../controllers/neuroBot.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.use(auth);
router.use((req, res, next) => {
  req.body = { ...(req.body || {}), userId: req.user._id.toString() };
  next();
});

router.post("/start", startSession);
router.post("/answer", processAnswer);
router.post("/report", generateReport); 

export default router;
 
