import { Request, Response, NextFunction } from "express";

import * as campaignService from "../services/campaign.service";

export async function createNewCampaign(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, messageTemplate, audienceFilter } = req.body;
        if (!name || !messageTemplate) {
            return res.status(400).json({ success: false, message: "name and messageTemplate are required", data: null, meta: null });
        }
        const campaign = await campaignService.createCampaign({ name, messageTemplate, audienceFilter });
        return res.status(201).json({ success: true, message: "Created New Campaign", data: campaign, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function startNewCampaign(req: Request, res: Response, next: NextFunction) {
    try {
        const campaign = await campaignService.startCampaign(req.params.id as string);
        return res.status(200).json({ success: true, message: "Campaign started", data: campaign, meta: null });
    } catch (err: any) {
        if (err.message.includes("not found")) return res.status(404).json({ success: false, message: err.message, data: null, meta: null });
        if (err.message.includes("Cannot start")) return res.status(400).json({ success: false, message: err.message, data: null, meta: null });
        next(err);
    }
}

export async function listAllCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
        const { cursor, limit, status } = req.query;
        const result = await campaignService.listCampaigns({
            cursor: cursor as string,
            limit: limit ? parseInt(limit as string, 10) : undefined,
            status: status as string,
        });
        return res.status(200).json({ success: true, message: "Fetched all Campaigns", data: result, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getCampaignDataById(req: Request, res: Response, next: NextFunction) {
    try {
        const campaign = await campaignService.getCampaignById(req.params.id as string);
        if (!campaign) return res.status(404).json({ message: "Campaign not found" });
        return res.status(200).json({ success: true, message: "Fetched Campaign", data: campaign, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getCampaignInternalDetails(req: Request, res: Response, next: NextFunction) {
    try {
        const details = await campaignService.getCampaignDetails(req.params.id as string);
        return res.status(200).json({ success: true, message: "Fetched Campaign Details", data: details, meta: null });
    } catch (err: any) {
        if (err.message.includes("not found")) return res.status(404).json({ success: false, message: err.message, data: null, meta: null });
        next(err);
    }
}

export async function getCampaignDeliveryLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const { cursor, limit, status } = req.query;
        const result = await campaignService.getCampaignLogs(req.params.id as string, {
            cursor: cursor as string,
            limit: limit ? parseInt(limit as string, 10) : undefined,
            status: status as string,
        });
        return res.status(200).json({ success: true, message: "Fetched Delivery Logs for this Campaign", data: result, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getDashboardData(_req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await campaignService.getDashboardStats();
        return res.status(200).json({ success: true, message: "Fetched Dashboard stats", data: stats, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function deleteCampaign(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await campaignService.deleteCampaign(req.params.id as string);
        if (!deleted) return res.status(404).json({ success: false, message: "Campaign not found", data: null, meta: null });
        return res.status(200).json({ success: true, message: "Campaign deleted", data: null, meta: null });
    } catch (err) {
        next(err);
    }
}
