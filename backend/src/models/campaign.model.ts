import mongoose, { Schema, Document } from "mongoose";

export enum CampaignStatus {
    DRAFT = 'draft',
    RUNNING = 'running',
    COMPLETED = 'completed',
    PAUSED = 'paused',
    FAILED = 'failed'
}

export interface IAudienceFilter {
    tags?: string[];
    search?: string;
}

export interface ICampaign extends Document {
    name: string;
    messageTemplate: string;
    status: CampaignStatus;
    audienceFilter: IAudienceFilter;
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    pendingCount: number;
    scheduledAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
    {
        name: { type: String, required: true, trim: true },
        messageTemplate: { type: String, required: true },
        status: {
            type: String,
            enum: Object.values(CampaignStatus),
            default: CampaignStatus.DRAFT,
        },
        audienceFilter: {
            tags: { type: [String], default: [] },
            search: { type: String, default: "" },
        },
        totalContacts: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        pendingCount: { type: Number, default: 0 },
        scheduledAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

campaignSchema.index({ status: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ status: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaign>("Campaign", campaignSchema);
