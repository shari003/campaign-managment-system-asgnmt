import api from "./axios";
import type { Contact, PaginatedResponse, UploadResult } from "../types";

export async function uploadContacts(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/contacts/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
}

export async function fetchContacts(params: {
    search?: string;
    tags?: string;
    cursor?: string;
    limit?: number;
}): Promise<PaginatedResponse<Contact>> {
    const { data } = await api.get("/contacts", { params });
    return {
        data: data.data.contacts,
        hasMore: data.data.hasMore,
        nextCursor: data.data.nextCursor,
    };
}

export async function fetchContactCount(): Promise<number> {
    const { data } = await api.get("/contacts/count");
    return data.data.count;
}

export async function deleteContact(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
}
