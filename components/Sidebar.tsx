"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { useFetcher } from "@/components/FetcherProvider";
import _constant from "@/utils/_constant";
import type { LlmConfig, ApiKeyConfig } from "@/types";

type LLMServiceKey = keyof typeof _constant.llmServices;

const navLinks = [
  { href: "/templates", label: "Templates" },
  { href: "/setting", label: "Settings" },
];

export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-50 p-2 rounded-md bg-card border border-border text-foreground hover:brightness-125 transition-all cursor-pointer"
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
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { fetcher } = useFetcher();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // LLM settings
  const [selectedService, setSelectedService] = useState<LLMServiceKey | "">(
    ""
  );
  const [selectedModel, setSelectedModel] = useState("");

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    mistral: null,
    together: null,
    openAi: null,
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const availableModels = selectedService
    ? _constant.llmServices[selectedService]?.models || []
    : [];

  const serviceOptions = Object.entries(_constant.llmServices).map(
    ([key, service]) => ({
      value: key,
      label: service.label,
    })
  );

  const modelOptions = availableModels.map((model) => ({
    value: model,
    label: model,
  }));

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
          setSelectedService(data.selectedLlm.service as LLMServiceKey);
          setSelectedModel(data.selectedLlm.model);
        }

        if (data?.apiKey) {
          setApiKeys({
            mistral: data.apiKey.mistral || null,
            together: data.apiKey.together || null,
            openAi: data.apiKey.openAi || null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoaded(true);
      }
    };

    fetchSettings();
  }, [isOpen, loaded, fetcher]);

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

  const handleServiceChange = (service: LLMServiceKey | "") => {
    setSelectedService(service);
    if (service && _constant.llmServices[service]?.models.length > 0) {
      setSelectedModel(_constant.llmServices[service].models[0]);
    } else {
      setSelectedModel("");
    }
  };

  const handleApiKeyChange = (key: keyof ApiKeyConfig, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
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
          apiKey: apiKeys,
        }),
      });

      setSaveMessage("Settings saved!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

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
          </nav>

          {/* Divider */}
          <hr className="border-border" />

          {/* User Settings Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-semibold text-secondary text-sm">
              LLM Configuration
            </h3>

            <FormField label="Provider:">
              <Select
                value={selectedService}
                onChange={(e) =>
                  handleServiceChange(e.target.value as LLMServiceKey | "")
                }
                options={serviceOptions}
                placeholder="Select a provider"
              />
            </FormField>

            <FormField label="Model:">
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                options={modelOptions}
                placeholder="Select a model"
                disabled={!selectedService}
              />
            </FormField>

            <h3 className="font-semibold text-secondary text-sm pt-2">
              API Keys
            </h3>

            <FormField label="Mistral AI:">
              <Input
                type="password"
                value={apiKeys.mistral || ""}
                onChange={(e) => handleApiKeyChange("mistral", e.target.value)}
                placeholder="Mistral API key"
              />
            </FormField>

            <FormField label="Together AI:">
              <Input
                type="password"
                value={apiKeys.together || ""}
                onChange={(e) => handleApiKeyChange("together", e.target.value)}
                placeholder="Together API key"
              />
            </FormField>

            <FormField label="OpenAI:">
              <Input
                type="password"
                value={apiKeys.openAi || ""}
                onChange={(e) => handleApiKeyChange("openAi", e.target.value)}
                placeholder="OpenAI API key"
              />
            </FormField>

            <div className="flex gap-2 items-center">
              <Button type="submit" disabled={saving} variant="primary" size="small">
                {saving ? "Saving..." : "Save"}
              </Button>
              {saveMessage && (
                <span className="text-green-500 text-xs">{saveMessage}</span>
              )}
            </div>
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
