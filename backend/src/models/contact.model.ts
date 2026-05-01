import mongoose, { Schema, Document } from "mongoose";

export interface IContact extends Document {
    name: string;
    email: string;
    phone?: string;
    tags: string[];
    metadata: Record<string, any>; // for columns other than the required ones in csv shall be added to this metadata object
    createdAt: Date;
    updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, trim: true, default: null },
        tags: { type: [String], default: [] },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

contactSchema.index({ email: 1 }, { unique: true });
contactSchema.index({ phone: 1 }, { sparse: true });
contactSchema.index({ tags: 1 });
contactSchema.index({ name: "text", email: "text" });
contactSchema.index({ createdAt: -1 });

export const Contact = mongoose.model<IContact>("Contact", contactSchema);
