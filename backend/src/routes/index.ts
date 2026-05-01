import { Router } from "express";
import contactRoutes from "./contact.routes";
import campaignRoutes from "./campaign.routes";

const router = Router();

router.use("/contacts", contactRoutes);
router.use("/campaigns", campaignRoutes);

export default router;
