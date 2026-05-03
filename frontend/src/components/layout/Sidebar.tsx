import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Megaphone, X } from "lucide-react";

import { cn } from "../../lib/utils";

const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/contacts", label: "Contacts", icon: Users },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone },
];

interface SidebarProps {
    open: boolean;
    onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
    return (
        <aside
            className={cn(
                "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out",
                "lg:translate-x-0",
                open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            )}
        >
            <div className="flex h-14 lg:h-16 items-center justify-between border-b border-zinc-800 px-5">
                <span className="text-lg font-black tracking-tight text-white">
                    ZaKKCMS
                </span>
                <button
                    onClick={onClose}
                    className="lg:hidden rounded-md p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close sidebar"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 space-y-0.5 px-3 py-4">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        onClick={onClose}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                                isActive
                                    ? "bg-white text-zinc-950"
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                            )
                        }
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
