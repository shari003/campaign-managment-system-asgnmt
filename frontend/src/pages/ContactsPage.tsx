import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Search, Trash2, CheckCircle, XCircle } from "lucide-react";

import type { UploadResult } from "../types";

import { formatDate } from "../lib/utils";
import { useDebounce } from "../utils/hooks/useDebounce";

import { fetchContacts, uploadContacts, deleteContact } from "../api/contacts.api";

import EmptyState from "../components/ui/EmptyState";

export default function ContactsPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [cursor, setCursor] = useState<string | undefined>();
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["contacts", debouncedSearch, cursor],
        queryFn: () => fetchContacts({ search: debouncedSearch || undefined, cursor, limit: 20 }),

        refetchInterval: false,
    });

    const uploadMutation = useMutation({
        mutationFn: uploadContacts,
        onSuccess: (result) => {
            setUploadResult(result);
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteContact,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setCursor(undefined);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadMutation.mutate(file);
            e.target.value = "";
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Contacts</h1>
                    <p className="mt-1 text-sm text-zinc-500">Manage your contact list</p>
                </div>
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
                    ${uploadMutation.isPending
                        ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                        : "bg-zinc-900 text-white hover:bg-zinc-700"
                    }`}>
                    <Upload className="h-4 w-4" />
                    {uploadMutation.isPending ? "Uploading..." : "Upload CSV"}
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadMutation.isPending}
                    />
                </label>
            </div>

            {uploadResult && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="flex-1 text-sm">
                        <p className="font-semibold text-zinc-900">Upload complete</p>
                        <p className="mt-0.5 text-zinc-500">
                            Parsed: <span className="font-medium text-zinc-800">{uploadResult.totalParsed}</span>
                            {" · "}Inserted: <span className="font-medium text-zinc-800">{uploadResult.insertedCount}</span>
                            {" · "}Updated: <span className="font-medium text-zinc-800">{uploadResult.modifiedCount}</span>
                            {uploadResult.errors.length > 0 && (
                                <span className="text-red-600"> · Errors: {uploadResult.errors.length}</span>
                            )}
                        </p>
                    </div>
                    <button onClick={() => setUploadResult(null)} className="text-zinc-400 hover:text-zinc-600 text-xs underline">
                        Dismiss
                    </button>
                </div>
            )}

            {uploadMutation.isError && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-sm text-zinc-700">
                        Upload failed: {(uploadMutation.error as Error).message}
                    </p>
                </div>
            )}

            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                {isLoading ? (
                    <div className="p-12 text-center text-sm text-zinc-400">Loading contacts...</div>
                ) : !data || data.data.length === 0 ? (
                    <EmptyState
                        title="No contacts found"
                        description={search ? "Try adjusting your search" : "Upload a CSV to get started"}
                    />
                ) : (
                    <table className="min-w-full divide-y divide-zinc-100">
                        <thead>
                            <tr className="bg-zinc-50">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Tags</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Created</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {data.data.map((contact) => (
                                <tr key={contact._id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{contact.name}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{contact.email}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{contact.phone || "—"}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-500">
                                        <div className="flex flex-wrap gap-1">
                                            {contact.tags.map((tag) => (
                                                <span key={tag} className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{formatDate(contact.createdAt)}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                        <button
                                            onClick={() => deleteMutation.mutate(contact._id)}
                                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                            title="Delete contact"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
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
