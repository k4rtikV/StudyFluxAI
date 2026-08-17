import { useState } from "react";
import { Outlet } from "react-router";

import AdminSidebar from "../components/admin/AdminSidebar";
import AdminTopbar from "../components/admin/AdminTopbar";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6f8fb]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-emerald-200/18 blur-3xl" />
        <div className="absolute right-[7%] top-[18%] h-96 w-96 rounded-full bg-cyan-200/16 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-96 w-96 rounded-full bg-violet-200/18 blur-3xl" />
      </div>

      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AdminTopbar onOpenSidebar={() => setSidebarOpen(true)} />

      <div className="relative lg:pl-[286px]">
        <main className="px-4 pb-8 pt-[104px] sm:px-6 xl:px-8">
          <div className="mx-auto max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
