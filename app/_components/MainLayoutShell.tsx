"use client";

import { usePathname } from "next/navigation";
import { HamburgerButton, Sidebar } from "@/app/_components/Sidebar";
import { AiApiLogDrawer } from "@/app/_components/AiApiLogDrawer";
import { useUiState } from "@/components/UiStateProvider";
import { useState } from "react";

export function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { uiState, setSidebarOpen } = useUiState();
  const [aiApiLogsOpen, setAiApiLogsOpen] = useState(false);

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <>
      <HamburgerButton onClick={() => setSidebarOpen(true)} />
      <Sidebar
        isOpen={uiState.sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenAiApiLogs={() => {
          setSidebarOpen(false);
          setAiApiLogsOpen(true);
        }}
      />
      <AiApiLogDrawer isOpen={aiApiLogsOpen} onClose={() => setAiApiLogsOpen(false)} />
      {children}
    </>
  );
}
