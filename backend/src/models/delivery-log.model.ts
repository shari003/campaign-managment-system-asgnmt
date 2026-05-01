import mongoose, { Schema, Document, Types } from "mongoose";

export enum DeliveryStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    SENT = 'sent',
    FAILED = 'failed'
}

export interface IDeliveryLog extends Document {
    campaignId: Types.ObjectId;
    contactId: Types.ObjectId;
    status: DeliveryStatus;
    retryCount: number;
    lastError?: string;
    sentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const deliveryLogSchema = new Schema<IDeliveryLog>(
    {
        campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
        contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: true },
        status: {
            type: String,
            enum: Object.values(DeliveryStatus),
            default: DeliveryStatus.QUEUED,
        },
        retryCount: { type: Number, default: 0 },
        lastError: { type: String, default: null },
        sentAt: { type: Date, default: null },
    },
    { timestamps: true },
);

deliveryLogSchema.index({ campaignId: 1, status: 1 });
deliveryLogSchema.index({ contactId: 1 });
deliveryLogSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
deliveryLogSchema.index({ status: 1 });
deliveryLogSchema.index({ campaignId: 1, createdAt: -1 });

export const DeliveryLog = mongoose.model<IDeliveryLog>("DeliveryLog", deliveryLogSchema);
