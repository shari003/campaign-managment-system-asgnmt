import { formatNumber } from "../../lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: number;
    icon: LucideIcon;
}

export default function StatCard({ title, value, icon: Icon }: StatCardProps) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
                    <p className="mt-1 text-3xl font-bold text-zinc-900">{formatNumber(value)}</p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-3 text-zinc-600">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}
