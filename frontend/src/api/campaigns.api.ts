import api from "./axios";
import type { Campaign, CampaignDetails, DashboardStats, DeliveryLog, PaginatedResponse, AudienceFilter } from "../types";

export async function createCampaign(data: {
    name: string;
    messageTemplate: string;
    audienceFilter?: AudienceFilter;
}): Promise<Campaign> {
    const res = await api.post("/campaigns", data);
    return res.data.data;
}

export async function fetchCampaigns(params?: {
    cursor?: string;
    limit?: number;
    status?: string;
}): Promise<PaginatedResponse<Campaign>> {
    const { data } = await api.get("/campaigns", { params });
    return {
        data: data.data.campaigns,
        hasMore: data.data.hasMore,
        nextCursor: data.data.nextCursor,
    };
}

export async function fetchCampaign(id: string): Promise<Campaign> {
    const { data } = await api.get(`/campaigns/${id}`);
    return data.data;
}

export async function fetchCampaignDetails(id: string): Promise<CampaignDetails> {
    const { data } = await api.get(`/campaigns/${id}/details`);
    return data.data;
}

export async function startCampaign(id: string): Promise<Campaign> {
    const { data } = await api.post(`/campaigns/${id}/start`);
    return data.data;
}

export async function fetchCampaignLogs(
    id: string,
    params?: { cursor?: string; limit?: number; status?: string },
): Promise<PaginatedResponse<DeliveryLog>> {
    const { data } = await api.get(`/campaigns/${id}/logs`, { params });
    return {
        data: data.data.logs,
        hasMore: data.data.hasMore,
        nextCursor: data.data.nextCursor,
    };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
    const { data } = await api.get("/campaigns/dashboard");
    return data.data;
}

export async function deleteCampaign(id: string): Promise<void> {
    await api.delete(`/campaigns/${id}`);
}
