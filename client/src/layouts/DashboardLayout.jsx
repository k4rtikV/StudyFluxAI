import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";

import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardTopbar from "../components/dashboard/DashboardTopbar";

function DashboardLayout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#f7f8fc]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-indigo-200/25 blur-3xl" />
        <div className="absolute right-[6%] top-[18%] h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="absolute bottom-[8%] left-[34%] h-96 w-96 rounded-full bg-emerald-200/16 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />
      </div>

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <DashboardTopbar onOpenSidebar={() => setSidebarOpen(true)} />

      <div className="relative min-w-0 min-[1440px]:pl-[286px]">
        <main className="px-3 pb-6 pt-[126px] sm:px-4 sm:pb-7 md:px-6 md:pt-[106px] xl:px-8 xl:pb-8">
          <div className="mx-auto min-w-0 max-w-[1500px]">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
