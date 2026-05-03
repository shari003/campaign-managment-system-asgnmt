import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

import Sidebar from "./Sidebar";

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-zinc-50">

            <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="rounded-md p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Open sidebar"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <span className="text-base font-black tracking-tight text-white">
                    ZaKKCMS
                </span>
            </header>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
                <div className="p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
