import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Trash2, Eye } from "lucide-react";

import type { Campaign } from "../types";
import { type ColumnDef } from "@tanstack/react-table";

import { formatDate, formatNumber } from "../lib/utils";
import { fetchCampaigns, startCampaign, deleteCampaign } from "../api/campaigns.api";

import DataTable from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";

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

    const columns = useMemo<ColumnDef<Campaign, unknown>[]>(() => [
        {
            accessorKey: "name",
            header: "Campaign",
            cell: ({ getValue }) => (
                <span className="font-semibold text-zinc-900 whitespace-nowrap">{getValue() as string}</span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
        },
        {
            accessorKey: "totalContacts",
            header: "Total",
            cell: ({ getValue }) => (
                <span className="text-zinc-600 whitespace-nowrap">{formatNumber(getValue() as number)}</span>
            ),
        },
        {
            accessorKey: "sentCount",
            header: "Sent",
            cell: ({ getValue }) => (
                <span className="text-zinc-900 font-medium whitespace-nowrap">{formatNumber(getValue() as number)}</span>
            ),
        },
        {
            accessorKey: "failedCount",
            header: "Failed",
            cell: ({ getValue }) => (
                <span className="text-zinc-600 whitespace-nowrap">{formatNumber(getValue() as number)}</span>
            ),
        },
        {
            accessorKey: "pendingCount",
            header: "Pending",
            cell: ({ getValue }) => (
                <span className="text-zinc-600 whitespace-nowrap">{formatNumber(getValue() as number)}</span>
            ),
        },
        {
            accessorKey: "createdAt",
            header: "Created",
            cell: ({ getValue }) => (
                <span className="text-zinc-500 whitespace-nowrap text-xs">{formatDate(getValue() as string)}</span>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const campaign = row.original;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${campaign._id}`); }}
                            className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                            title="View details"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                        {campaign.status === "draft" && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); startMutation.mutate(campaign._id); }}
                                    disabled={startMutation.isPending}
                                    className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors disabled:opacity-50"
                                    title="Start campaign"
                                >
                                    <Play className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(campaign._id); }}
                                    className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                    title="Delete campaign"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ], [navigate, startMutation, deleteMutation]);

    return (
        <div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Campaigns</h1>
                    <p className="mt-1 text-sm text-zinc-500">Create and manage messaging campaigns</p>
                </div>
                <button
                    onClick={() => navigate("/campaigns/new")}
                    className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors self-start sm:self-auto"
                >
                    <Plus className="h-4 w-4" />
                    New Campaign
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <DataTable
                    columns={columns}
                    data={data?.data ?? []}
                    isLoading={isLoading}
                    loadingText="Loading campaigns..."
                    onRowClick={(row) => navigate(`/campaigns/${row.original._id}`)}
                    emptyNode={
                        <EmptyState
                            title="No campaigns yet"
                            description="Create your first campaign to start messaging contacts"
                            action={
                                <button
                                    onClick={() => navigate("/campaigns/new")}
                                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create Campaign
                                </button>
                            }
                        />
                    }
                />

                {data?.hasMore && (
                    <div className="flex justify-center border-t border-zinc-100 p-4">
                        <button
                            onClick={() => setCursor(data.nextCursor!)}
                            className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
