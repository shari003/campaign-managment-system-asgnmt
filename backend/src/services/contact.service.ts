import csvParser from "csv-parser";
import { Types } from "mongoose";
import { Readable } from "stream";

import { Contact } from "../models/contact.model";

export async function uploadCSV(fileBuffer: Buffer) {
    const contacts: Record<string, any>[] = [];
    const parseErrors: string[] = [];

    await new Promise<void>((resolve, reject) => {
        const stream = Readable.from(fileBuffer);
        let row = 0;

        stream
            .pipe(csvParser())
            .on("data", (data: Record<string, string>) => {
                row++;
                const email = (data.email || "").trim().toLowerCase();
                if (!email) {
                    parseErrors.push(`Row ${row}: missing email`);
                    return;
                }

                const knownFields = new Set(["name", "email", "phone", "tags"]);
                const metadata: Record<string, any> = {};
                for (const key of Object.keys(data)) {
                    if (!knownFields.has(key) && data[key]) {
                        metadata[key] = data[key];
                    }
                }

                contacts.push({
                    name: (data.name || "").trim(),
                    email,
                    phone: (data.phone || "").trim() || undefined,
                    tags: data.tags
                        ? data.tags.split(";").map((t) => t.trim()).filter(Boolean)
                        : [],
                    ...(Object.keys(metadata).length > 0 && { metadata }),
                });
            })
            .on("end", resolve)
            .on("error", reject);
    });

    const ops = contacts.map((c) => ({
        updateOne: {
            filter: { email: c.email },
            update: { $set: c },
            upsert: true,
        },
    }));

    let insertedCount = 0;
    let modifiedCount = 0;
    const bulkErrors: string[] = [];
    const batchSize = 5000;

    for (let i = 0; i < ops.length; i += batchSize) {
        try {
            const result = await Contact.bulkWrite(ops.slice(i, i + batchSize), { ordered: false });
            insertedCount += result.upsertedCount;
            modifiedCount += result.modifiedCount;
        } catch (err: any) {
            bulkErrors.push(`Batch ${Math.floor(i / batchSize)}: ${err.message}`);
        }
    }

    return {
        totalParsed: contacts.length,
        insertedCount,
        modifiedCount,
        errors: [...parseErrors, ...bulkErrors],
    };
}

export async function listContacts(params: {
    search?: string;
    tags?: string[];
    cursor?: string;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}) {
    const { search, tags, cursor, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = params;
    const filter: Record<string, any> = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    if (Array.isArray(tags) && tags.length > 0) {
        filter.tags = { $in: tags };
    }

    if (cursor) {
        filter._id = { [sortOrder === "desc" ? "$lt" : "$gt"]: new Types.ObjectId(cursor) };
    }

    const contacts = await Contact.find(filter)
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .limit(limit + 1)
        .lean();

    const hasMore = contacts.length > limit;
    if (hasMore) contacts.pop();

    return {
        contacts,
        hasMore,
        nextCursor: hasMore ? contacts[contacts.length - 1]._id?.toString() : null,
    };
}

export async function getContactById(id: string) {
    return Contact.findById(id).lean();
}

export async function getContactCount() {
    return Contact.estimatedDocumentCount();
}

export async function getContactIdsByFilter(filter: Record<string, any>): Promise<Types.ObjectId[]> {
    const contacts = await Contact.find(filter).select("_id").lean();
    return contacts.map((c) => c._id as Types.ObjectId);
}

export async function deleteContact(id: string) {
    const result = await Contact.findByIdAndDelete(id);
    return result !== null;
}
