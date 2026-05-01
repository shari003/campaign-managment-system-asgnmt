import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Send, AlertCircle, Clock, CheckCircle } from "lucide-react";

import { formatDate } from "../lib/utils";
import { CampaignStatus } from "../types";

import { fetchCampaignDetails, fetchCampaignLogs, startCampaign } from "../api/campaigns.api";

import StatusBadge from "../components/ui/StatusBadge";
import StatCard from "../components/ui/StatCard";

export default function CampaignDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [logCursor, setLogCursor] = useState<string | undefined>();
    const [logFilter, setLogFilter] = useState<string>("");

    const { data: details, isLoading } = useQuery({
        queryKey: ["campaign-details", id],
        queryFn: () => fetchCampaignDetails(id!),
        enabled: !!id,
        refetchInterval: 5000,
    });

    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ["campaign-logs", id, logCursor, logFilter],
        queryFn: () => fetchCampaignLogs(id!, { cursor: logCursor, limit: 25, status: logFilter || undefined }),
        enabled: !!id,
        refetchInterval: 5000,
    });

    const startMutation = useMutation({
        mutationFn: startCampaign,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campaign-details", id] });
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        },
    });

    if (isLoading) {
        return <div className="p-12 text-center text-sm text-zinc-400">Loading campaign...</div>;
    }

    if (!details) {
        return <div className="p-12 text-center text-sm text-zinc-400">Campaign not found</div>;
    }

    const { campaign } = details;
    const progress = campaign.totalContacts > 0
        ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalContacts) * 100)
        : 0;

    return (
        <div>
            <button
                onClick={() => navigate("/campaigns")}
                className="cursor-pointer mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to campaigns
            </button>

            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-zinc-900">{campaign.name}</h1>
                        <StatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Created {formatDate(campaign.createdAt)}</p>
                </div>
                {campaign.status === CampaignStatus.DRAFT && (
                    <button
                        onClick={() => startMutation.mutate(campaign._id)}
                        disabled={startMutation.isPending}
                        className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        <Play className="h-4 w-4" />
                        {startMutation.isPending ? "Starting..." : "Start Campaign"}
                    </button>
                )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Message Template</p>
                <p className="text-sm text-zinc-800 whitespace-pre-wrap">{campaign.messageTemplate}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total" value={campaign.totalContacts} icon={CheckCircle} />
                <StatCard title="Sent" value={campaign.sentCount} icon={Send} />
                <StatCard title="Failed" value={campaign.failedCount} icon={AlertCircle} />
                <StatCard title="Pending" value={campaign.pendingCount} icon={Clock} />
            </div>

            {([CampaignStatus.COMPLETED, CampaignStatus.RUNNING].includes(campaign.status)) && (
                <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700">Processing progress</span>
                        <span className="font-mono font-semibold text-zinc-900">{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                            className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Delivery Logs */}
            <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-zinc-900">Delivery Logs</h2>
                    <select
                        value={logFilter}
                        onChange={(e) => { setLogFilter(e.target.value); setLogCursor(undefined); }}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                        <option value="">All statuses</option>
                        <option value="queued">Queued</option>
                        <option value="processing">Processing</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    {logsLoading ? (
                        <div className="p-12 text-center text-sm text-zinc-400">Loading logs...</div>
                    ) : !logs || logs.data.length === 0 ? (
                        <div className="p-12 text-center text-sm text-zinc-400">No delivery logs found</div>
                    ) : (
                        <table className="min-w-full divide-y divide-zinc-100">
                            <thead>
                                <tr className="bg-zinc-50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Contact</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Retries</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Sent At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {logs.data.map((log) => (
                                    <tr key={log._id} className="hover:bg-zinc-50 transition-colors">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">
                                            {log.contactId?.name || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                                            {log.contactId?.email || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <StatusBadge status={log.status} />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{log.retryCount}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                                            {log.sentAt ? formatDate(log.sentAt) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {logs && logs.hasMore && (
                        <div className="flex justify-center border-t border-zinc-100 p-4">
                            <button
                                onClick={() => setLogCursor(logs.nextCursor!)}
                                className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                            >
                                Load More
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
