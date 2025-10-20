import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@douyinfe/semi-ui";
import { IconCopy, IconCheckboxTick } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import "./styles.css";

export default function ChatMessage({ message, onApplySuggestion, onCopyCode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onCopyCode) onCopyCode(code);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const extractCodeBlocks = (content) => {
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    return parts;
  };

  const renderMessageContent = (content) => {
    const parts = extractCodeBlocks(content);
    
    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <div key={index} className="ai-code-block">
            <pre>{part.content}</pre>
            <button
              className="ai-code-copy"
              onClick={() => handleCopyCode(part.content)}
            >
              {copied ? <IconCheckboxTick /> : <IconCopy />}
              {copied ? t("ai_copied") : t("ai_copy_code")}
            </button>
          </div>
        );
      } else {
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ inline, children }) => (
                <code className={inline ? "inline-code" : ""}>
                  {children}
                </code>
              ),
              strong: ({ children }) => <strong>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
              ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      }
    });
  };

  const hasActionableContent = (content) => {
    const actionKeywords = [
      'CREATE TABLE',
      'ADD TABLE',
      'FOREIGN KEY',
      'suggest',
      'recommend',
      'add',
      'create'
    ];
    
    return actionKeywords.some(keyword => 
      content.toUpperCase().includes(keyword)
    );
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`ai-message ${message.role}`}>
      <div className="ai-message-bubble">
        {renderMessageContent(message.content)}
      </div>
      
      {message.timestamp && (
        <div className="ai-message-time">
          {formatTime(message.timestamp)}
        </div>
      )}

      {message.role === 'ai' && hasActionableContent(message.content) && (
        <div className="ai-message-actions">
          <Button
            size="small"
            type="primary"
            onClick={() => onApplySuggestion && onApplySuggestion(message.content)}
          >
            {t("ai_apply_suggestion")}
          </Button>
          <Button
            size="small"
            type="tertiary"
            onClick={() => onCopyCode && onCopyCode(message.content)}
          >
            {t("ai_copy_response")}
          </Button>
        </div>
      )}
    </div>
  );
}
