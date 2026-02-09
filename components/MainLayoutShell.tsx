"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HamburgerButton, Sidebar } from "@/components/Sidebar";

export function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <>
      <HamburgerButton onClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {children}
    </>
  );
}
