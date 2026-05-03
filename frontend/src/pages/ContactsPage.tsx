import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchContacts, uploadContacts, deleteContact } from "../api/contacts.api";
import { Upload, Search, Trash2, CheckCircle, XCircle } from "lucide-react";

import type { Contact, UploadResult } from "../types";
import { type ColumnDef } from "@tanstack/react-table";

import { formatDate } from "../lib/utils";

import DataTable from "../components/ui/DataTable";
import EmptyState from "../components/ui/EmptyState";

export default function ContactsPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [cursor, setCursor] = useState<string | undefined>();
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["contacts", debouncedSearch, cursor],
        queryFn: () => fetchContacts({ search: debouncedSearch || undefined, cursor, limit: 20 }),
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

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        setCursor(undefined);
        const t = setTimeout(() => setDebouncedSearch(value), 300);
        return () => clearTimeout(t);
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { uploadMutation.mutate(file); e.target.value = ""; }
    };

    const columns = useMemo<ColumnDef<Contact, unknown>[]>(() => [
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ getValue }) => (
                <span className="font-medium text-zinc-900 whitespace-nowrap">{getValue() as string}</span>
            ),
        },
        {
            accessorKey: "email",
            header: "Email",
            cell: ({ getValue }) => (
                <span className="text-zinc-500 whitespace-nowrap">{getValue() as string}</span>
            ),
        },
        {
            accessorKey: "phone",
            header: "Phone",
            cell: ({ getValue }) => (
                <span className="text-zinc-500 whitespace-nowrap">{getValue() as string || "—"}</span>
            ),
        },
        {
            accessorKey: "tags",
            header: "Tags",
            cell: ({ getValue }) => {
                const tags = getValue() as string[];
                return (
                    <div className="flex flex-wrap gap-1 max-w-45">
                        {tags.length === 0
                            ? <span className="text-zinc-400">—</span>
                            : tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 whitespace-nowrap"
                                >
                                    {tag}
                                </span>
                            ))
                        }
                    </div>
                );
            },
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
            cell: ({ row }) => (
                <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(row.original._id); }}
                    className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                    title="Delete contact"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            ),
        },
    ], [deleteMutation]);

    return (
        <div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Contacts</h1>
                    <p className="mt-1 text-sm text-zinc-500">Manage your contact list</p>
                </div>
                <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors self-start sm:self-auto
                    ${uploadMutation.isPending ? "bg-zinc-300 text-zinc-500 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-zinc-700 cursor-pointer"}`}>
                    <Upload className="h-4 w-4" />
                    {uploadMutation.isPending ? "Uploading..." : "Upload CSV"}
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploadMutation.isPending} />
                </label>
            </div>

            {uploadResult && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="flex-1 min-w-0 text-sm">
                        <p className="font-semibold text-zinc-900">Upload complete</p>
                        <p className="mt-0.5 text-zinc-500 flex flex-wrap gap-x-2">
                            <span>Parsed: <b className="text-zinc-800">{uploadResult.totalParsed}</b></span>
                            <span>Inserted: <b className="text-zinc-800">{uploadResult.insertedCount}</b></span>
                            <span>Updated: <b className="text-zinc-800">{uploadResult.modifiedCount}</b></span>
                            {uploadResult.errors.length > 0 && (
                                <span className="text-red-600">Errors: {uploadResult.errors.length}</span>
                            )}
                        </p>
                    </div>
                    <button onClick={() => setUploadResult(null)} className="cursor-pointer text-zinc-400 hover:text-zinc-600 text-xs underline shrink-0">
                        Dismiss
                    </button>
                </div>
            )}

            {uploadMutation.isError && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-sm text-zinc-700">{(uploadMutation.error as Error).message}</p>
                </div>
            )}

            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <DataTable
                    columns={columns}
                    data={data?.data ?? []}
                    isLoading={isLoading}
                    loadingText="Loading contacts..."
                    emptyNode={
                        <EmptyState
                            title="No contacts found"
                            description={search ? "Try adjusting your search" : "Upload a CSV to get started"}
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
