"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { useFetcher } from "@/components/FetcherProvider";
import _constant from "@/utils/_constant";
import type { LlmConfig, ApiKeyConfig } from "@/types";

type LLMServiceKey = keyof typeof _constant.llmServices;

export default function UserSettingPage() {
  const { fetcher } = useFetcher();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // LLM settings
  const [selectedService, setSelectedService] = useState<LLMServiceKey | "">("");
  const [selectedModel, setSelectedModel] = useState("");

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    mistral: null,
    together: null,
    openAi: null,
  });

  // Get available models for selected service
  const availableModels = selectedService
    ? _constant.llmServices[selectedService]?.models || []
    : [];

  // Build options for dropdowns
  const serviceOptions = Object.entries(_constant.llmServices).map(([key, service]) => ({
    value: key,
    label: service.label,
  }));

  const modelOptions = availableModels.map((model) => ({
    value: model,
    label: model,
  }));

  useEffect(() => {
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
        setLoading(false);
      }
    };

    fetchSettings();
  }, [fetcher]);

  const handleServiceChange = (service: LLMServiceKey | "") => {
    setSelectedService(service);
    // Reset model when service changes
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
          ? { service: selectedService as LlmConfig["service"], model: selectedModel }
          : null;

      await fetcher("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedLlm,
          apiKey: apiKeys,
        }),
      });

      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4 text-secondary">User Settings</h1>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4 text-secondary">User Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">LLM Configuration</legend>

          <FormField label="LLM Provider:">
            <Select
              value={selectedService}
              onChange={(e) => handleServiceChange(e.target.value as LLMServiceKey | "")}
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
        </fieldset>

        <fieldset className="mb-4 p-4 border border-border rounded bg-card/50">
          <legend className="font-semibold text-secondary px-2">API Keys</legend>

          <FormField label="Mistral AI API Key:">
            <Input
              type="password"
              value={apiKeys.mistral || ""}
              onChange={(e) => handleApiKeyChange("mistral", e.target.value)}
              placeholder="Enter your Mistral API key"
            />
          </FormField>

          <FormField label="Together AI API Key:">
            <Input
              type="password"
              value={apiKeys.together || ""}
              onChange={(e) => handleApiKeyChange("together", e.target.value)}
              placeholder="Enter your Together API key"
            />
          </FormField>

          <FormField label="OpenAI API Key:">
            <Input
              type="password"
              value={apiKeys.openAi || ""}
              onChange={(e) => handleApiKeyChange("openAi", e.target.value)}
              placeholder="Enter your OpenAI API key"
            />
          </FormField>
        </fieldset>

        <div className="flex gap-4 items-center">
          <Button type="submit" disabled={saving} variant="primary">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saveMessage && (
            <span className="text-green-500 text-sm">{saveMessage}</span>
          )}
        </div>
      </form>
    </div>
  );
}
