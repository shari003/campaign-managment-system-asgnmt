import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
    return (
        <div className="min-h-screen bg-zinc-50">
            <Sidebar />
            <main className="ml-64 p-8">
                <Outlet />
            </main>
        </div>
    );
}
