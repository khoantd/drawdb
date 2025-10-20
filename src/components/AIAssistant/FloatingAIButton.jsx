import { Button, Tooltip } from "@douyinfe/semi-ui";
import { IconEdit } from "@douyinfe/semi-icons";
import { useAI } from "../../hooks";
import { useTranslation } from "react-i18next";
import "./styles.css";

export default function FloatingAIButton() {
  const { isOpen, togglePanel, aiConfig } = useAI();
  const { t } = useTranslation();

  // Don't show button if AI is not enabled or configured
  if (!aiConfig.enabled || !aiConfig.endpoint) {
    return null;
  }

  return (
    <Tooltip content={t("ai_assistant")} position="left">
      <button
        className={`ai-floating-button ${isOpen ? 'active' : ''}`}
        onClick={togglePanel}
        aria-label={t("ai_assistant")}
      >
        <IconEdit size="large" />
      </button>
    </Tooltip>
  );
}
