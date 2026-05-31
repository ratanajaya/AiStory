"use client";

import { usePathname } from "next/navigation";
import { HamburgerButton, Sidebar } from "@/app/_components/Sidebar";
import { useUiState } from "@/components/UiStateProvider";

export function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { uiState, setSidebarOpen } = useUiState();

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <>
      <HamburgerButton onClick={() => setSidebarOpen(true)} />
      <Sidebar isOpen={uiState.sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {children}
    </>
  );
}
