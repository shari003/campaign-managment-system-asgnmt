interface EmptyStateProps {
    title: string;
    description: string;
    action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="mt-4 text-base font-semibold text-zinc-900">{title}</h3>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
