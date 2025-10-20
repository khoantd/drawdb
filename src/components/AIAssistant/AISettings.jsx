import React, { useState, useEffect } from "react";
import { 
  Form, 
  Input, 
  Button, 
  Select, 
  Switch, 
  Typography, 
  Space,
  Toast,
  Divider
} from "@douyinfe/semi-ui";
import { IconCheckboxTick, IconClose, IconRefresh } from "@douyinfe/semi-icons";
import { useAI } from "../../hooks";
import { useSettings } from "../../hooks";
import { useTranslation } from "react-i18next";
import LiteLLMClient from "../../api/litellm";

const { Text, Title } = Typography;

export default function AISettings() {
  const { aiConfig, updateAiConfig } = useAI();
  const { settings, setSettings } = useSettings();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    enabled: settings.aiEnabled || false,
    endpoint: settings.aiEndpoint || "",
    apiKey: settings.aiApiKey || "",
    model: settings.aiModel || "gpt-3.5-turbo"
  });
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Update form data when settings change
  useEffect(() => {
    const newFormData = {
      enabled: settings.aiEnabled || false,
      endpoint: settings.aiEndpoint || "",
      apiKey: settings.aiApiKey || "",
      model: settings.aiModel || "gpt-3.5-turbo"
    };
    console.log("Updating form data from settings:", newFormData);
    setFormData(newFormData);
  }, [settings.aiEnabled, settings.aiEndpoint, settings.aiApiKey, settings.aiModel]);

  const modelOptions = [
    { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    { label: "GPT-4", value: "gpt-4" },
    { label: "GPT-4 Turbo", value: "gpt-4-turbo-preview" },
    { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
    { label: "Claude 3 Sonnet", value: "claude-3-sonnet-20240229" },
    { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
    { label: "Gemini Pro", value: "gemini-pro" },
    { label: "Llama 2 70B", value: "llama-2-70b-chat" },
    { label: "Mixtral 8x7B", value: "mixtral-8x7b-instruct" }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Update settings
    const newSettings = {
      ...settings,
      aiEnabled: formData.enabled,
      aiEndpoint: formData.endpoint,
      aiApiKey: formData.apiKey,
      aiModel: formData.model
    };
    
    setSettings(newSettings);
    updateAiConfig(formData);
    
    Toast.success(t("ai_settings_saved"));
  };

  const handleTestConnection = async () => {
    if (!formData.endpoint || !formData.apiKey) {
      Toast.warning(t("ai_fill_required_fields"));
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const client = new LiteLLMClient(formData.endpoint, formData.apiKey, formData.model);
      const result = await client.testConnection();
      
      setTestResult(result);
      
      if (result.success) {
        Toast.success(t("ai_connection_success"));
      } else {
        Toast.error(result.error);
      }
    } catch (error) {
      const result = {
        success: false,
        error: error.message || t("ai_connection_failed")
      };
      setTestResult(result);
      Toast.error(result.error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      enabled: false,
      endpoint: "",
      apiKey: "",
      model: "gpt-3.5-turbo"
    });
    setTestResult(null);
  };

  return (
    <div style={{ padding: "16px" }}>
      <Title heading={6} style={{ marginBottom: "16px" }}>
        {t("ai_assistant_settings")}
      </Title>
      
      <Form layout="vertical">
        <Form.Switch
          field="enabled"
          label={t("ai_enable_assistant")}
          checked={formData.enabled}
          onChange={(checked) => handleInputChange("enabled", checked)}
        />
        
        <Text type="tertiary" style={{ marginBottom: "16px", display: "block" }}>
          {t("ai_enable_description")}
        </Text>

        <Divider />

        <Form.Input
          field="endpoint"
          label={t("ai_endpoint")}
          placeholder="https://your-litellm-endpoint.com"
          value={formData.endpoint}
          onChange={(value) => handleInputChange("endpoint", value)}
          disabled={!formData.enabled}
          style={{ marginBottom: "16px" }}
        />

        <Form.Input
          field="apiKey"
          label={t("ai_api_key")}
          type="password"
          placeholder="sk-..."
          value={formData.apiKey}
          onChange={(value) => handleInputChange("apiKey", value)}
          disabled={!formData.enabled}
          style={{ marginBottom: "16px" }}
        />

        <Form.Select
          field="model"
          label={t("ai_model")}
          placeholder={t("ai_select_model")}
          value={formData.model}
          onChange={(value) => handleInputChange("model", value)}
          disabled={!formData.enabled}
          style={{ marginBottom: "16px" }}
        >
          {modelOptions.map(option => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Form.Select>

        {testResult && (
          <div style={{ 
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "6px",
            backgroundColor: testResult.success ? "var(--semi-color-success-light)" : "var(--semi-color-danger-light)",
            border: `1px solid ${testResult.success ? "var(--semi-color-success)" : "var(--semi-color-danger)"}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {testResult.success ? <IconCheckboxTick /> : <IconClose />}
              <Text style={{ color: testResult.success ? "var(--semi-color-success)" : "var(--semi-color-danger)" }}>
                {testResult.success ? t("ai_connection_success") : testResult.error}
              </Text>
            </div>
          </div>
        )}

        <Space>
          <Button
            type="primary"
            onClick={handleSave}
            disabled={!formData.enabled}
          >
            {t("ai_save_settings")}
          </Button>
          
          <Button
            onClick={handleTestConnection}
            loading={isTesting}
            disabled={!formData.enabled || !formData.endpoint || !formData.apiKey}
            icon={<IconRefresh />}
          >
            {t("ai_test_connection")}
          </Button>
          
          <Button
            type="tertiary"
            onClick={handleReset}
          >
            {t("ai_reset")}
          </Button>
        </Space>
      </Form>

      <Divider style={{ margin: "24px 0" }} />

      <div>
        <Title heading={6} style={{ marginBottom: "8px" }}>
          {t("ai_help_title")}
        </Title>
        <Text type="tertiary" style={{ fontSize: "14px", lineHeight: "1.5" }}>
          {t("ai_help_description")}
        </Text>
        
        <div style={{ marginTop: "12px" }}>
          <Text strong style={{ fontSize: "14px" }}>
            {t("ai_supported_features")}:
          </Text>
          <ul style={{ marginTop: "8px", paddingLeft: "20px", fontSize: "14px", color: "var(--semi-color-text-2)" }}>
            <li>{t("ai_feature_schema_optimization")}</li>
            <li>{t("ai_feature_sql_generation")}</li>
            <li>{t("ai_feature_natural_language")}</li>
            <li>{t("ai_feature_relationship_analysis")}</li>
            <li>{t("ai_feature_index_suggestions")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
