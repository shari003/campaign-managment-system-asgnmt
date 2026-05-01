import { Router } from "express";
import { createNewCampaign, startNewCampaign, listAllCampaigns, getCampaignDataById, getCampaignInternalDetails, getCampaignDeliveryLogs, getDashboardData, deleteCampaign } from "../controllers/campaign.controller";

const router = Router();

router.post("/", createNewCampaign);
router.get("/", listAllCampaigns);
router.get("/dashboard", getDashboardData);
router.get("/:id", getCampaignDataById);
router.get("/:id/details", getCampaignInternalDetails);
router.get("/:id/logs", getCampaignDeliveryLogs);
router.post("/:id/start", startNewCampaign);
router.delete("/:id", deleteCampaign);

export default router;
