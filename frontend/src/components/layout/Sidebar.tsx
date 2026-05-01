import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Megaphone } from "lucide-react";
import { cn } from "../../lib/utils";

const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/contacts", label: "Contacts", icon: Users },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone },
];

export default function Sidebar() {
    return (
        <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col bg-zinc-950 border-r border-zinc-800">
            <div className="flex h-16 items-center border-b border-zinc-800 px-6">
                <span className="text-lg font-black tracking-tight text-white">
                    ZaKKCMS
                </span>
            </div>
            <nav className="flex-1 space-y-0.5 px-3 py-4">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-white text-zinc-950"
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                            )
                        }
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </NavLink>
                ))}
            </nav>
            <div className="border-t border-zinc-800 px-6 py-4">
                <p className="text-xs text-zinc-600">Campaign Management System</p>
            </div>
        </aside>
    );
}
