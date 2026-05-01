import { Request, Response, NextFunction } from "express";

import * as contactService from "../services/contact.service";

export async function uploadContacts(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded", data: null, meta: null });
        const result = await contactService.uploadCSV(req.file.buffer);
        return res.status(200).json({ success: true, message: "CSV processed successfully", data: result, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getAllContacts(req: Request, res: Response, next: NextFunction) {
    try {
        const { search, tags, cursor, limit, sortBy, sortOrder } = req.query;
        const result = await contactService.listContacts({
            search: search as string,
            tags: tags ? (tags as string).split(",") : undefined,
            cursor: cursor as string,
            limit: limit ? parseInt(limit as string, 10) : undefined,
            sortBy: sortBy as string,
            sortOrder: sortOrder as "asc" | "desc",
        });
        return res.status(200).json({ success: true, message: "Fetched all contacts", data: result, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getContactById(req: Request, res: Response, next: NextFunction) {
    try {
        const contact = await contactService.getContactById(req.params.id as string);
        if (!contact) return res.status(404).json({ message: "Contact not found" });
        return res.status(200).json({ success: true, message: "Fetched Contact Details", data: contact, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function getContactCount(_req: Request, res: Response, next: NextFunction) {
    try {
        const count = await contactService.getContactCount();
        return res.status(200).json({ success: true, message: "Fetched Total Contacts Count", data: { count }, meta: null });
    } catch (err) {
        next(err);
    }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await contactService.deleteContact(req.params.id as string);
        if (!deleted) return res.status(404).json({ success: false, message: "Contact not found", data: null, meta: null });
        return res.status(200).json({ success: true, message: "Contact deleted", data: null, meta: null });
    } catch (err) {
        next(err);
    }
}
