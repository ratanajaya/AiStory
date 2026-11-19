"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import SignInToKeepLink from '@/app/_components/SignInToKeepLink';
import { TtsSettingsSection } from '@/components/TtsSettingsSection';
import { AiSettingsSection } from "@/components/AiSettingsSection";
import { Button } from "@/components/Button";
import { useFetcher } from "@/components/FetcherProvider";
import { useApiKeySettings } from "@/components/useApiKeySettings";
import { getUnsupportedLlmMessage, isSupportedLlmService } from "@/lib/llmSettings";
import type { ConfiguredApiKeys } from '@/lib/apiKeySettings';
import _constant from "@/utils/_constant";
import type { AiModelOption, AutocompletePreference } from "@/types";

const emptyModels: AiModelOption[] = [];

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
  const keys = useApiKeySettings();
  const { setConfigured } = keys;
  const [viewerKind, setViewerKind] = useState<'visitor' | 'guest' | 'user' | null>(null);
  useEffect(() => { fetcher<{ kind: 'visitor' | 'guest' | 'user' }>('/api/viewer', { silent: true }).then((viewer) => setViewerKind(viewer.kind)).catch(() => setViewerKind('visitor')); }, [fetcher, pathname]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // LLM settings
  const [selectedService, setSelectedService] = useState<string>(_constant.defaultSelectedLlm.service);
  const [selectedModel, setSelectedModel] = useState(_constant.defaultSelectedLlm.model);
  const [autocomplete, setAutocomplete] = useState<AutocompletePreference>();
  const [savingMode, setSavingMode] = useState<'save' | 'test' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load user settings in the background with the model catalogs.
  useEffect(() => {
    if (loaded || viewerKind !== 'user') return;

    const fetchSettings = async () => {
      try {
        const data = await fetcher<{
          selectedLlm?: { service: string; model: string };
          autocomplete?: AutocompletePreference;
          configured: ConfiguredApiKeys;
        }>("/api/user/settings");

        if (data?.selectedLlm) {
          setSelectedService(data.selectedLlm.service);
          setSelectedModel(data.selectedLlm.model);
        }

        setConfigured(data.configured ?? {});
        setAutocomplete(data?.autocomplete ?? null);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoaded(true);
      }
    };

    fetchSettings();
  }, [loaded, fetcher, viewerKind, setConfigured]);

  const isSupportedService = isSupportedLlmService(selectedService);
  const catalog = isSupportedService
    ? keys.getEntry(selectedService, keys.modelKeys[selectedService])
    : null;
  const models = catalog?.models ?? emptyModels;
  const modelLoading = catalog?.loading ?? false;
  const modelLoadError = catalog?.error ?? null;

  useEffect(() => {
    if (isSupportedService && selectedService !== 'openAi' && !selectedModel && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [isSupportedService, selectedService, selectedModel, models]);

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
    setSelectedService(service);
    setSelectedModel(service === "openAi" ? _constant.defaultSelectedLlm.model : "");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const testModels = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'test';
    const apiKey = keys.getUpdates(event.currentTarget);
    const selectedLlm = isSupportedService && selectedModel ? { service: selectedService, model: selectedModel } : null;
    setSavingMode(testModels ? 'test' : 'save');
    setStatusMessage(null);

    try {
      await fetcher("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        silent: testModels,
        body: JSON.stringify({ selectedLlm, autocomplete, apiKey, ...(testModels ? { testModels } : {}) }),
      });
      keys.markSaved(apiKey);
      window.dispatchEvent(new Event("aistory:settings"));
      setStatusMessage({
        type: "success",
        text: testModels ? "Model checks passed. Settings saved." : "Settings saved!",
      });
    } catch (error) {
      if (testModels) {
        const message = error instanceof Error ? error.message : "Model test failed";
        setStatusMessage({ type: "error", text: message });
      }
    } finally {
      setSavingMode(null);
    }
  };

  const modelUnavailable =
    isSupportedService && keys.draft[selectedService] !== null && !modelLoading &&
    Boolean(selectedModel) &&
    models.length > 0 &&
    !models.some((model) => model.id === selectedModel);
  const llmError = selectedService && !isSupportedService
    ? getUnsupportedLlmMessage(selectedService)
    : modelUnavailable
      ? "The selected model is unavailable; choose a model from the fetched list."
      : isSupportedService && !selectedModel
        ? "Select a model."
        : null;
  const actionDisabled = !loaded || savingMode !== null || Boolean(llmError);

  if (viewerKind !== 'user') return (<>
    {isOpen && <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />}
    <div className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-card p-5 transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <button className="self-end" onClick={onClose} aria-label="Close sidebar">?</button><h2 className="mb-5 font-bold">AI Story</h2>
      <Link className="mb-3" href="/" onClick={onClose}>Library</Link><Link className="mb-3" href="/templates" onClick={onClose}>Templates</Link>
      {viewerKind && <button className="mb-3 text-left" onClick={() => { window.dispatchEvent(new Event('aistory:keys')); onClose(); }}>Use your own API key</button>}
      <SignInToKeepLink onNavigate={onClose} />
    </div>
  </>);

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

          {isOpen && <TtsSettingsSection credentialsDirty={keys.ttsKeysDirty} />}

          {/* User Settings Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AiSettingsSection
              selectedService={selectedService}
              selectedModel={selectedModel}
              apiKey={keys.draft}
              onServiceChange={(service) =>
                handleServiceChange(service)
              }
              onModelChange={setSelectedModel}
              onApiKeyChange={keys.updateKey}
              onApiKeyBlur={keys.onKeyBlur}
              configured={keys.configured}
              onToggleKeyRemoval={keys.toggleRemoval}
              keysDisabled={!loaded || savingMode !== null}
              models={models}
              modelLoading={modelLoading}
              modelLoadError={modelLoadError}
              llmError={llmError}
              autocomplete={{ value: autocomplete, onChange: setAutocomplete, modelKeys: keys.modelKeys, inherit: true, disabled: !loaded || savingMode !== null }}
              variant="sidebar"
            />

            <div className="flex gap-2 items-center">
              <Button type="submit" disabled={actionDisabled} variant="primary" size="small">
                {savingMode === 'save' ? "Saving..." : "Save"}
              </Button>
              <Button
                type="submit"
                value="test"
                disabled={actionDisabled}
                variant="outline"
                size="small"
              >
                {savingMode === 'test' ? "Testing..." : "Save & Test"}
              </Button>
            </div>
            {statusMessage && (
              <div
                role="status"
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
            onClick={() => signOut({ callbackUrl: "/" })}
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
