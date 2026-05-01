import { cn } from "../../lib/utils";

const statusColors: Record<string, string> = {
    draft:      "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300",
    running:    "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    completed:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    paused:     "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    failed:     "bg-red-50 text-red-700 ring-1 ring-red-200",
    queued:     "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300",
    processing: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    sent:       "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

export default function StatusBadge({ status }: { status: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                statusColors[status] ?? "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300",
            )}
        >
            {status}
        </span>
    );
}
