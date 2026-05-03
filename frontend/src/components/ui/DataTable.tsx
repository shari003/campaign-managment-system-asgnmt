import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
    type Row,
} from "@tanstack/react-table";

interface DataTableProps<T> {
    columns: ColumnDef<T, unknown>[];
    data: T[];
    onRowClick?: (row: Row<T>) => void;
    emptyNode?: React.ReactNode;
    isLoading?: boolean;
    loadingText?: string;
}

export default function DataTable<T>({
    columns,
    data,
    onRowClick,
    emptyNode,
    isLoading,
    loadingText = "Loading...",
}: DataTableProps<T>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading) {
        return (
            <div className="p-12 text-center text-sm text-zinc-400">{loadingText}</div>
        );
    }

    if (!isLoading && data.length === 0 && emptyNode) {
        return <>{emptyNode}</>;
    }

    return (
        <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-zinc-100">
                <thead>
                    {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id} className="bg-zinc-50">
                            {hg.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400"
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {table.getRowModel().rows.map((row) => (
                        <tr
                            key={row.id}
                            onClick={() => onRowClick?.(row)}
                            className={`transition-colors hover:bg-zinc-50 ${onRowClick ? "cursor-pointer" : ""}`}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="px-4 py-3.5 text-sm align-middle">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
