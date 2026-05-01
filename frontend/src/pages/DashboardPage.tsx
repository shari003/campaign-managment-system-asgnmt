import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "../api/campaigns.api";
import { Users, Megaphone, Send, AlertCircle, Clock } from "lucide-react";

import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";

export default function DashboardPage() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ["dashboard"],
        queryFn: fetchDashboardStats,
        refetchInterval: 5000,
    });

    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (!stats) return null;

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-500">Campaign performance overview</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total Contacts" value={stats.totalContacts} icon={Users} />
                <StatCard title="Campaigns" value={stats.totalCampaigns} icon={Megaphone} />
                <StatCard title="Messages Sent" value={stats.totalSent} icon={Send} />
                <StatCard title="Failed" value={stats.totalFailed} icon={AlertCircle} />
                <StatCard title="Pending" value={stats.totalPending} icon={Clock} />
            </div>

            <div className="mt-8">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                    Campaigns by Status
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Object.entries(stats.campaignsByStatus).map(([status, count]) => (
                        <div key={status} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                            <StatusBadge status={status} />
                            <p className="mt-3 text-2xl font-bold text-zinc-900">{count}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div>
            <div className="mb-8">
                <div className="h-7 w-40 animate-pulse rounded-md bg-zinc-200" />
                <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-200" />
                ))}
            </div>
        </div>
    );
}
