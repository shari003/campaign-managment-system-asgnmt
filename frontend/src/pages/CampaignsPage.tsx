import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Trash2, Eye } from "lucide-react";

import { formatDate, formatNumber } from "../lib/utils";

import { fetchCampaigns, startCampaign, deleteCampaign } from "../api/campaigns.api";

import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import { CampaignStatus } from "../types";

export default function CampaignsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [cursor, setCursor] = useState<string | undefined>();

    const { data, isLoading } = useQuery({
        queryKey: ["campaigns", cursor],
        queryFn: () => fetchCampaigns({ cursor, limit: 20 }),
        refetchInterval: 5000,
    });

    const startMutation = useMutation({
        mutationFn: startCampaign,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCampaign,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Campaigns</h1>
                    <p className="mt-1 text-sm text-zinc-500">Create and manage messaging campaigns</p>
                </div>
                <button
                    onClick={() => navigate("/campaigns/new")}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    New Campaign
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                {isLoading ? (
                    <div className="p-12 text-center text-sm text-zinc-400">Loading campaigns...</div>
                ) : !data || data.data.length === 0 ? (
                    <EmptyState
                        title="No campaigns yet"
                        description="Create your first campaign to start messaging contacts"
                        action={
                            <button
                                onClick={() => navigate("/campaigns/new")}
                                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Create Campaign
                            </button>
                        }
                    />
                ) : (
                    <table className="min-w-full divide-y divide-zinc-100">
                        <thead>
                            <tr className="bg-zinc-50">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Campaign</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Sent</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Failed</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Pending</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Created</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {data?.data?.map((campaign) => (
                                <tr key={campaign._id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-zinc-900">{campaign.name}</td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <StatusBadge status={campaign.status} />
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">{formatNumber(campaign.totalContacts)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{formatNumber(campaign.sentCount)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">{formatNumber(campaign.failedCount)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">{formatNumber(campaign.pendingCount)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{formatDate(campaign.createdAt)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => navigate(`/campaigns/${campaign._id}`)}
                                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                                title="View details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            {campaign.status === CampaignStatus.DRAFT && (
                                                <>
                                                    <button
                                                        onClick={() => startMutation.mutate(campaign._id)}
                                                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                                        title="Start campaign"
                                                        disabled={startMutation.isPending}
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteMutation.mutate(campaign._id)}
                                                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                                        title="Delete campaign"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {data && data.hasMore && (
                    <div className="flex justify-center border-t border-zinc-100 p-4">
                        <button
                            onClick={() => setCursor(data.nextCursor!)}
                            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
