import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Send, AlertCircle, Clock, CheckCircle } from "lucide-react";

import { type ColumnDef } from "@tanstack/react-table";
import type { DeliveryLog } from "../types";

import { fetchCampaignDetails, fetchCampaignLogs, startCampaign } from "../api/campaigns.api";
import { formatDate } from "../lib/utils";

import DataTable from "../components/ui/DataTable";
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

    const logColumns = useMemo<ColumnDef<DeliveryLog, unknown>[]>(() => [
        {
            id: "contact",
            header: "Contact",
            cell: ({ row }) => (
                <span className="font-medium text-zinc-900 whitespace-nowrap">
                    {row.original.contactId?.name || "—"}
                </span>
            ),
        },
        {
            id: "email",
            header: "Email",
            cell: ({ row }) => (
                <span className="text-zinc-500 whitespace-nowrap">
                    {row.original.contactId?.email || "—"}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
        },
        {
            accessorKey: "retryCount",
            header: "Retries",
            cell: ({ getValue }) => (
                <span className="text-zinc-500 whitespace-nowrap">{getValue() as string}</span>
            ),
        },
        {
            accessorKey: "sentAt",
            header: "Sent At",
            cell: ({ getValue }) => (
                <span className="text-zinc-500 whitespace-nowrap text-xs">
                    {getValue() ? formatDate(getValue() as string) : "—"}
                </span>
            ),
        },
    ], []);

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
                className="cursor-pointer mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to campaigns
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 truncate">
                            {campaign.name}
                        </h1>
                        <StatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Created {formatDate(campaign.createdAt)}</p>
                </div>
                {campaign.status === "draft" && (
                    <button
                        onClick={() => startMutation.mutate(campaign._id)}
                        disabled={startMutation.isPending}
                        className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50 self-start shrink-0"
                    >
                        <Play className="h-4 w-4" />
                        {startMutation.isPending ? "Starting..." : "Start Campaign"}
                    </button>
                )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Message Template
                </p>
                <p className="text-sm text-zinc-800 whitespace-pre-wrap wrap-break-word">
                    {campaign.messageTemplate}
                </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4">
                <StatCard title="Total" value={campaign.totalContacts} icon={CheckCircle} />
                <StatCard title="Sent" value={campaign.sentCount} icon={Send} />
                <StatCard title="Failed" value={campaign.failedCount} icon={AlertCircle} />
                <StatCard title="Pending" value={campaign.pendingCount} icon={Clock} />
            </div>

            {(campaign.status === "running" || campaign.status === "completed") && (
                <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
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

            <div className="mt-8">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-semibold text-zinc-900">Delivery Logs</h2>
                    <select
                        value={logFilter}
                        onChange={(e) => { setLogFilter(e.target.value); setLogCursor(undefined); }}
                        className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 self-start sm:self-auto"
                    >
                        <option value="">All statuses</option>
                        <option value="queued">Queued</option>
                        <option value="processing">Processing</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <DataTable
                        columns={logColumns}
                        data={logs?.data ?? []}
                        isLoading={logsLoading}
                        loadingText="Loading logs..."
                        emptyNode={
                            <div className="p-12 text-center text-sm text-zinc-400">
                                No delivery logs found
                            </div>
                        }
                    />

                    {logs?.hasMore && (
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
