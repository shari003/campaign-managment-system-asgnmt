import { Types } from "mongoose";

import { DeliveryLog } from "../models/delivery-log.model";
import { Contact } from "../models/contact.model";
import { Campaign, CampaignStatus } from "../models/campaign.model";

import { getContactIdsByFilter } from "./contact.service";
import { getCampaignQueue } from "../queues/queue.config";

function buildAudienceFilter(audienceFilter?: { tags?: string[]; search?: string }) {
    const filter: Record<string, any> = {};
    if (!audienceFilter) return filter;
    if (audienceFilter.tags && audienceFilter.tags.length > 0) {
        filter.tags = { $in: audienceFilter.tags };
    }
    if (audienceFilter.search) {
        filter.$or = [
            { name: { $regex: audienceFilter.search, $options: "i" } },
            { email: { $regex: audienceFilter.search, $options: "i" } },
        ];
    }
    return filter;
}

export async function createCampaign(data: {
    name: string;
    messageTemplate: string;
    audienceFilter?: { tags?: string[]; search?: string };
}) {
    const contactFilter = buildAudienceFilter(data.audienceFilter);
    const contactIds = await getContactIdsByFilter(contactFilter);

    const campaign = await Campaign.create({
        name: data.name,
        messageTemplate: data.messageTemplate,
        audienceFilter: data.audienceFilter || {},
        totalContacts: contactIds.length,
        pendingCount: contactIds.length,
    });

    if (contactIds.length > 0) {
        const logs = contactIds.map((contactId) => ({
            campaignId: campaign._id,
            contactId,
            status: "queued",
        }));

        const batchSize = 5000;
        for (let i = 0; i < logs.length; i += batchSize) {
            await DeliveryLog.insertMany(logs.slice(i, i + batchSize), { ordered: false });
        }
    }

    return campaign;
}

export async function startCampaign(campaignId: string) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== CampaignStatus.DRAFT) throw new Error(`Cannot start campaign in "${campaign.status}" status`);

    const updated = await Campaign.findByIdAndUpdate(
        campaignId,
        { $set: { status: CampaignStatus.RUNNING } },
        { new: true },
    ).lean();

    await getCampaignQueue().add("process-campaign", { campaignId }, {
        jobId: `campaign-${campaignId}`,
    });

    return updated;
}

export async function listCampaigns(params: { cursor?: string; limit?: number; status?: string }) {
    const { cursor, limit = 20, status } = params;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    const campaigns = await Campaign.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean();

    const hasMore = campaigns.length > limit;
    if (hasMore) campaigns.pop();

    return {
        campaigns,
        hasMore,
        nextCursor: hasMore ? campaigns[campaigns.length - 1]._id?.toString() : null,
    };
}

export async function getCampaignById(id: string) {
    return Campaign.findById(id).lean();
}

export async function getCampaignDetails(campaignId: string) {
    const [campaign, statusCounts, timeline] = await Promise.all([
        Campaign.findById(campaignId).lean(),
        DeliveryLog.aggregate([
            { $match: { campaignId: new Types.ObjectId(campaignId) } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        DeliveryLog.aggregate([
            { $match: { campaignId: new Types.ObjectId(campaignId) } },
            {
                $group: {
                    _id: {
                        status: "$status",
                        minute: { $dateToString: { format: "%Y-%m-%dT%H:%M", date: "$updatedAt" } },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.minute": 1 } },
        ]),
    ]);

    if (!campaign) throw new Error("Campaign not found");

    const counts: Record<string, number> = {};
    for (const s of statusCounts) counts[s._id] = s.count;

    return { campaign, counts, timeline };
}

export async function getCampaignLogs(
    campaignId: string,
    params: { cursor?: string; limit?: number; status?: string },
) {
    const { cursor, limit = 50, status } = params;
    const filter: Record<string, any> = { campaignId: new Types.ObjectId(campaignId) };
    if (status) filter.status = status;
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    const logs = await DeliveryLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate("contactId", "name email phone")
        .lean();

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    return {
        logs,
        hasMore,
        nextCursor: hasMore ? logs[logs.length - 1]._id?.toString() : null,
    };
}

export async function getDashboardStats() {
    const [campaignStats, totalContacts] = await Promise.all([
        Campaign.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalSent: { $sum: "$sentCount" },
                    totalFailed: { $sum: "$failedCount" },
                    totalPending: { $sum: "$pendingCount" },
                },
            },
        ]),
        Contact.estimatedDocumentCount(),
    ]);

    let totalCampaigns = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalPending = 0;
    const campaignsByStatus: Record<string, number> = {};

    for (const stat of campaignStats) {
        totalCampaigns += stat.count;
        totalSent += stat.totalSent;
        totalFailed += stat.totalFailed;
        totalPending += stat.totalPending;
        campaignsByStatus[stat._id] = stat.count;
    }

    return { totalContacts, totalCampaigns, totalSent, totalFailed, totalPending, campaignsByStatus };
}

export async function deleteCampaign(id: string) {
    await DeliveryLog.deleteMany({ campaignId: new Types.ObjectId(id) });
    const result = await Campaign.findByIdAndDelete(id);
    return result !== null;
}
