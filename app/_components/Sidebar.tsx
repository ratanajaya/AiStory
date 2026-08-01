"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { AiSettingsSection } from "@/components/AiSettingsSection";
import { Button } from "@/components/Button";
import { useFetcher } from "@/components/FetcherProvider";
import { streamAiRequest } from "@/lib/aiStreamClient";
import _constant from "@/utils/_constant";
import _util from "@/utils/_util";
import type { AiModelOption, LlmConfig, ApiKeyConfig } from "@/types";

const navLinks = [
  { href: "/", label: "Library" },
  { href: "/templates", label: "Templates" },
  { href: "/setting", label: "Settings" },
];

export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-10 p-2 rounded-md bg-card border border-border text-foreground hover:brightness-125 transition-all cursor-pointer"
      aria-label="Toggle sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

export function Sidebar({
  isOpen,
  onClose,
  onOpenAiApiLogs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenAiApiLogs: () => void;
}) {
  const pathname = usePathname();
  const { fetcher } = useFetcher();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // LLM settings
  const [selectedService, setSelectedService] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [togetherModels, setTogetherModels] = useState<AiModelOption[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    ..._constant.emptyApiKey,
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch user settings on first open
  useEffect(() => {
    if (!isOpen || loaded) return;

    const fetchSettings = async () => {
      try {
        const data = await fetcher<{
          selectedLlm?: { service: string; model: string };
          apiKey?: ApiKeyConfig;
        }>("/api/user/settings");

        if (data?.selectedLlm) {
          setSelectedService(data.selectedLlm.service);
          setSelectedModel(data.selectedLlm.model);
        }

        if (data?.apiKey) {
          setApiKeys(_util.normalizeApiKeyConfig(data.apiKey));
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoaded(true);
      }
    };

    fetchSettings();
  }, [isOpen, loaded, fetcher]);

  useEffect(() => {
    if (!isOpen || selectedService !== "together") {
      setModelLoadError(null);
      return;
    }

    const apiKey = _util.toInputString(apiKeys.together);

    let canceled = false;
    const fetchModels = async () => {
      try {
        setModelLoading(true);
        setModelLoadError(null);
        const data = await fetcher<{ models: AiModelOption[] }>("/api/ai/models/together", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiKey ? { apiKey } : {}),
          silent: true,
        });
        if (!canceled) {
          setTogetherModels(data.models);
          if (data.models.length === 0) {
            setModelLoadError("No Together chat models were returned.");
          }
        }
      } catch (err) {
        if (!canceled) {
          setTogetherModels([]);
          setModelLoadError(err instanceof Error ? err.message : "Failed to load Together models.");
        }
      } finally {
        if (!canceled) {
          setModelLoading(false);
        }
      }
    };

    fetchModels();
    return () => {
      canceled = true;
    };
  }, [isOpen, selectedService, apiKeys.together, fetcher]);

  useEffect(() => {
    if (selectedService === "together" && !selectedModel && togetherModels.length > 0) {
      setSelectedModel(togetherModels[0].id);
    }
  }, [selectedService, selectedModel, togetherModels]);

  // Close sidebar when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleServiceChange = (service: string) => {
    const serviceConfig = _constant.llmServices[service as keyof typeof _constant.llmServices];
    setSelectedService(service);
    setSelectedModel(service === "together" ? "" : serviceConfig?.models[0] ?? "");
  };

  const handleApiKeyChange = (key: keyof ApiKeyConfig, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveCurrentSettings = async () => {
    const selectedLlm: LlmConfig | null =
      selectedService && selectedModel
        ? {
            service: selectedService as LlmConfig["service"],
            model: selectedModel,
          }
        : null;

    await fetcher("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedLlm,
        apiKey: _util.normalizeApiKeyConfig(apiKeys),
      }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      await saveCurrentSettings();

      setStatusMessage({ type: "success", text: "Settings saved!" });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestModel = async () => {
    setTesting(true);
    setStatusMessage(null);

    try {
      await saveCurrentSettings();

      const result = await streamAiRequest(
        {
          feature: "default",
          systemMessage: "You are a connectivity test. Reply with exactly: OK",
          messages: [
            {
              role: "user",
              content: "Reply with exactly OK.",
            },
          ],
        },
        {
          onChunk: () => {},
        }
      );

      setStatusMessage({
        type: "success",
        text: `Model test passed: ${result.slice(0, 80)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model test failed";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setTesting(false);
    }
  };

  const isSupportedService = !selectedService || selectedService in _constant.llmServices;
  const togetherModelUnavailable =
    selectedService === "together" &&
    Boolean(selectedModel) &&
    togetherModels.length > 0 &&
    !togetherModels.some((model) => model.id === selectedModel);
  const llmError = !isSupportedService
    ? "Mistral is no longer supported; choose Together AI or OpenAI."
    : togetherModelUnavailable
      ? "The selected Together model is unavailable; choose a model from the fetched list."
      : selectedService === "together" && !selectedModel && !modelLoading
        ? "Select a Together AI model."
        : null;
  const actionDisabled = saving || testing || modelLoading || Boolean(llmError) || Boolean(modelLoadError);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-80 bg-card border-l border-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-secondary">AI Story</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Navigation Links */}
          <nav className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === link.href || pathname?.startsWith(link.href + "/")
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={onOpenAiApiLogs}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              AI API Logs
            </button>
          </nav>

          {/* Divider */}
          <hr className="border-border" />

          {/* User Settings Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AiSettingsSection
              selectedService={selectedService}
              selectedModel={selectedModel}
              apiKey={apiKeys}
              onServiceChange={(service) =>
                handleServiceChange(service)
              }
              onModelChange={setSelectedModel}
              onApiKeyChange={handleApiKeyChange}
              togetherModels={togetherModels}
              modelLoading={modelLoading}
              modelLoadError={modelLoadError}
              llmError={llmError}
              variant="sidebar"
            />

            <div className="flex gap-2 items-center">
              <Button type="submit" disabled={actionDisabled} variant="primary" size="small">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                disabled={actionDisabled}
                variant="outline"
                size="small"
                onClick={handleTestModel}
              >
                {testing ? "Testing..." : "Save & Test"}
              </Button>
            </div>
            {statusMessage && (
              <div
                className={`text-xs ${
                  statusMessage.type === "success" ? "text-green-500" : "text-red-500"
                }`}
              >
                {statusMessage.text}
              </div>
            )}
          </form>
        </div>

        {/* Logout button - pinned to bottom */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={() => signOut({ callbackUrl: "/login" })}
            variant="danger"
            size="default"
            className="w-full"
          >
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
