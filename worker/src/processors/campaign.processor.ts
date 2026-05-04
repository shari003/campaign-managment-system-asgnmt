import { Job } from "bullmq";
import { Types } from "mongoose";

import { Campaign, CampaignStatus } from "../models/campaign.model";
import { DeliveryLog, DeliveryStatus } from "../models/delivery-log.model";

const BATCH_SIZE = 500;
const DELAY_MS = 100;
const FAILURE_RATE = 0.1;

function simulateDelay(ms = DELAY_MS): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCampaign(job: Job<{ campaignId: string }>) {
    const { campaignId } = job.data;
    console.log(`[Worker] Starting campaign ${campaignId}`);

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== CampaignStatus.RUNNING) {
        console.log(`[Worker] Campaign ${campaignId} is not in running state, skipping`);
        return;
    }

    let processedTotal = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await DeliveryLog.find({
            campaignId: new Types.ObjectId(campaignId),
            status: DeliveryStatus.QUEUED,
        })
            .limit(BATCH_SIZE)
            .lean();

        if (batch.length === 0) {
            hasMore = false;
            break;
        }

        const batchIds = batch.map((log) => log._id as Types.ObjectId);
        await DeliveryLog.updateMany(
            { _id: { $in: batchIds } },
            { $set: { status: DeliveryStatus.PROCESSING } },
        );

        await simulateDelay(); // faking here

        const sentIds: Types.ObjectId[] = [];
        const failedIds: Types.ObjectId[] = [];

        for (const log of batch) {
            if (Math.random() < FAILURE_RATE) {
                failedIds.push(log._id as Types.ObjectId);
            } else {
                sentIds.push(log._id as Types.ObjectId);
            }
        }

        if (sentIds.length > 0) {
            await DeliveryLog.updateMany(
                { _id: { $in: sentIds } },
                { $set: { status: DeliveryStatus.SENT, sentAt: new Date() } },
            );
        }

        if (failedIds.length > 0) {
            await DeliveryLog.updateMany(
                { _id: { $in: failedIds } },
                {
                    $set: { status: DeliveryStatus.FAILED, lastError: "Simulated delivery failure" },
                    $inc: { retryCount: 1 },
                },
            );
        }

        await Campaign.findByIdAndUpdate(campaignId, {
            $inc: {
                sentCount: sentIds.length,
                failedCount: failedIds.length,
                pendingCount: -(sentIds.length + failedIds.length), // (+ of -) is -
            },
        });

        processedTotal += batch.length;
        const progress = campaign.totalContacts ? Math.round((processedTotal / campaign.totalContacts) * 100) : 100;
        await job.updateProgress(progress);

        console.log(`[Worker] Campaign ${campaignId}: processed ${processedTotal}/${campaign.totalContacts} (${sentIds.length} sent, ${failedIds.length} failed)`);
    }

    await Campaign.findByIdAndUpdate(campaignId, {
        $set: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });

    console.log(`[Worker] Campaign ${campaignId} completed. Total processed: ${processedTotal}`);
}

export default processCampaign;
