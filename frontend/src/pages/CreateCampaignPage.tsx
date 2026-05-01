import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, XCircle } from "lucide-react";

import { createCampaign } from "../api/campaigns.api";

export default function CreateCampaignPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [name, setName] = useState("");
    const [messageTemplate, setMessageTemplate] = useState("");
    const [tags, setTags] = useState("");
    const [audienceSearch, setAudienceSearch] = useState("");

    const mutation = useMutation({
        mutationFn: createCampaign,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            navigate("/campaigns");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const audienceFilter: Record<string, unknown> = {};
        if (tags.trim()) audienceFilter.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        if (audienceSearch.trim()) audienceFilter.search = audienceSearch.trim();

        mutation.mutate({
            name,
            messageTemplate,
            audienceFilter: Object.keys(audienceFilter).length > 0 ? audienceFilter : undefined,
        });
    };

    return (
        <div>
            <button
                onClick={() => navigate("/campaigns")}
                className="cursor-pointer mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to campaigns
            </button>

            <h1 className="text-2xl font-bold text-zinc-900">Create Campaign</h1>
            <p className="mt-1 text-sm text-zinc-500">Set up a new messaging campaign</p>

            <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
                <div>
                    <label className="block text-sm font-medium text-zinc-700">
                        Campaign Name <span className="text-zinc-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Summer Sale Announcement"
                        className={"mt-1 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700">
                        Message Template <span className="text-zinc-400">*</span>
                    </label>
                    <textarea
                        required
                        rows={4}
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        placeholder="Hi there, check out our latest offers!"
                        className={"mt-1 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"}
                    />
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-zinc-700">Audience Filter</h3>
                        <p className="mt-0.5 text-xs text-zinc-400">Leave empty to target all contacts</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-600">Filter by Tags</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="e.g., premium, active (comma separated)"
                                className={"mt-1 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-600">Search Filter</label>
                            <input
                                type="text"
                                value={audienceSearch}
                                onChange={(e) => setAudienceSearch(e.target.value)}
                                placeholder="Filter by name or email pattern"
                                className={"mt-1 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"}
                            />
                        </div>
                    </div>
                </div>

                {mutation.isError && (
                    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <p className="text-sm text-zinc-700">{(mutation.error as Error).message}</p>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="cursor-pointer rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        {mutation.isPending ? "Creating..." : "Create Campaign"}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/campaigns")}
                        className="cursor-pointer rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
