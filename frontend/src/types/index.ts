export interface Contact {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    tags: string[];
    metadata?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}

export enum CampaignStatus {
    DRAFT = 'draft',
    RUNNING = 'running',
    COMPLETED = 'completed',
    PAUSED = 'paused',
    FAILED = 'failed'
}

export interface AudienceFilter {
    tags?: string[];
    search?: string;
}

export interface Campaign {
    _id: string;
    name: string;
    messageTemplate: string;
    status: CampaignStatus;
    audienceFilter: AudienceFilter;
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    pendingCount: number;
    scheduledAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export enum DeliveryStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    SENT = 'sent',
    FAILED = 'failed'
}

export interface DeliveryLog {
    _id: string;
    campaignId: string;
    contactId: Contact;
    status: DeliveryStatus;
    retryCount: number;
    lastError?: string;
    sentAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    hasMore: boolean;
    nextCursor: string | null;
}

export interface DashboardStats {
    totalContacts: number;
    totalCampaigns: number;
    totalSent: number;
    totalFailed: number;
    totalPending: number;
    campaignsByStatus: Record<string, number>;
}

export interface CampaignDetails {
    campaign: Campaign;
    counts: Record<string, number>;
    timeline: Array<{
        _id: { status: string; minute: string };
        count: number;
    }>;
}

export interface UploadResult {
    totalParsed: number;
    insertedCount: number;
    modifiedCount: number;
    errors: string[];
}
