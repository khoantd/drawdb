import React, { useState, useRef, useEffect } from "react";
import { Button, Input, Typography } from "@douyinfe/semi-ui";
import { IconClose, IconSend, IconEdit } from "@douyinfe/semi-icons";
import { nanoid } from "nanoid";
import { useAI } from "../../hooks";
import { useDiagram, useAreas, useNotes, useTypes, useEnums, useUndoRedo } from "../../hooks";
import { useTranslation } from "react-i18next";
import LiteLLMClient from "../../api/litellm";
import { buildDiagramContext, parseAIResponse, hasActionableSuggestions } from "../../utils/aiHelpers";
import ChatMessage from "./ChatMessage";
import "./styles.css";

const { Text } = Typography;

export default function AIChatPanel() {
  const { 
    isOpen, 
    messages, 
    isLoading, 
    error, 
    addMessage, 
    setLoading, 
    setErrorState, 
    clearError,
    clearMessages,
    closePanel,
    aiConfig 
  } = useAI();
  
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get diagram context
  const { tables, relationships, database, addTable, addRelationship } = useDiagram();
  const { areas } = useAreas();
  const { notes, addNote } = useNotes();
  const { types } = useTypes();
  const { enums } = useEnums();
  const { setUndoStack, setRedoStack } = useUndoRedo();

  // Debug: Log current context data
  useEffect(() => {
    console.log("Current diagram context in AIChatPanel:");
    console.log("- Tables:", tables);
    console.log("- Relationships:", relationships);
    console.log("- Database:", database);
    console.log("- Areas:", areas);
    console.log("- Notes:", notes);
    console.log("- Types:", types);
    console.log("- Enums:", enums);
    
    // Check if data is loaded
    if (tables && tables.length > 0) {
      console.log("✅ Diagram data is loaded and available for AI");
    } else {
      console.log("⚠️ Diagram data is not loaded yet or empty");
    }
  }, [tables, relationships, database, areas, notes, types, enums]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: inputValue.trim()
    };

    addMessage(userMessage);
    setInputValue("");
    setLoading(true);
    clearError();

    // Check if this is a design review request
    const isDesignReview = inputValue.toLowerCase().includes('review') || 
                          inputValue.toLowerCase().includes('improve') ||
                          inputValue.toLowerCase().includes('suggest') ||
                          inputValue.toLowerCase().includes('optimize');
    
    if (isDesignReview) {
      console.log("Design review request detected, providing enhanced context");
    }

    try {
      // Check if data is loaded
      if (!tables || tables.length === 0) {
        addMessage({
          role: "ai",
          content: "⚠️ No diagram data found. Please make sure you have tables and relationships in your diagram before asking for AI assistance."
        });
        setLoading(false);
        return;
      }

      // Build diagram context
      const diagramContext = buildDiagramContext({
        tables,
        relationships,
        database,
        areas,
        notes,
        types,
        enums
      });
      
      console.log("Sending diagram context to AI:", diagramContext);

      // Create LiteLLM client
      const client = new LiteLLMClient(aiConfig.endpoint, aiConfig.apiKey, aiConfig.model);

      // Send message to AI
      const response = await client.sendMessage(userMessage.content, diagramContext);

      if (response.success) {
        const aiMessage = {
          role: "ai",
          content: response.content
        };
        addMessage(aiMessage);
      } else {
        setErrorState(response.error);
      }
    } catch (error) {
      console.error("AI request failed:", error);
      setErrorState("Failed to send message. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleApplySuggestion = async (content) => {
    try {
      console.log("Applying suggestion from content:", content);
      const suggestions = parseAIResponse(content);
      console.log("Parsed suggestions:", suggestions);
      console.log("Tables to add:", suggestions.tables);
      console.log("Relationships to add:", suggestions.relationships);
      console.log("Notes to add:", suggestions.notes);
      let appliedCount = 0;
      let errors = [];
      
      // Apply table suggestions first
      const addedTables = [];
      for (const tableData of suggestions.tables) {
        try {
          // Check if table already exists
          const existingTable = tables.find(t => t.name === tableData.name);
          if (existingTable) {
            console.log(`Table ${tableData.name} already exists, skipping`);
            continue;
          }
          
          console.log("Adding table:", tableData);
          const tableId = nanoid();
          const newTable = {
            id: tableId,
            name: tableData.name,
            x: 100 + (appliedCount * 300), // Spread tables horizontally
            y: 100,
            locked: false,
            fields: tableData.fields.map(field => ({
              id: nanoid(),
              name: field.name,
              type: field.type,
              default: field.defaultValue || "",
              check: "",
              primary: field.primaryKey || false,
              unique: field.unique || false,
              notNull: field.notNull || false,
              increment: field.increment || false,
              comment: field.comment || "",
            })),
            comment: tableData.comment || "",
            indices: [],
            color: "#ffffff",
          };
          
          addTable(newTable, true);
          addedTables.push(newTable);
          console.log("Successfully added table:", newTable.name);
          appliedCount++;
        } catch (error) {
          console.error("Error adding table:", error);
          errors.push(`Failed to add table ${tableData.name}: ${error.message}`);
        }
      }
      
      // Apply relationship suggestions after tables are added
      for (const relData of suggestions.relationships) {
        try {
          console.log("Adding relationship:", relData);
          // Look in both existing tables and newly added tables
          const allTables = [...tables, ...addedTables];
          const sourceTable = allTables.find(t => t.name === relData.fromTable);
          const targetTable = allTables.find(t => t.name === relData.toTable);
          
          if (!sourceTable || !targetTable) {
            errors.push(`Could not find tables for relationship: ${relData.fromTable} → ${relData.toTable}`);
            continue;
          }
          
          // Find appropriate fields for the relationship
          const sourceField = sourceTable.fields.find(f => f.name === relData.fromField) || 
                             sourceTable.fields.find(f => f.primary) || 
                             sourceTable.fields[0];
          const targetField = targetTable.fields.find(f => f.name === relData.toField) || 
                             targetTable.fields.find(f => f.primary) || 
                             targetTable.fields[0];
          
          if (!sourceField || !targetField) {
            errors.push(`Could not find appropriate fields for relationship: ${relData.fromTable} → ${relData.toTable}`);
            continue;
          }
          
          const relationshipId = nanoid();
          const newRelationship = {
            id: relationshipId,
            name: `rel_${relationshipId}`,
            startTableId: sourceTable.id,
            endTableId: targetTable.id,
            startFieldId: sourceField.id,
            endFieldId: targetField.id,
            cardinality: relData.cardinality || "one_to_many",
            constraint: relData.constraint || "No action",
            color: "#000000",
          };
          
          addRelationship(newRelationship, true);
          console.log("Successfully added relationship:", newRelationship.name);
          appliedCount++;
        } catch (error) {
          console.error("Error adding relationship:", error);
          errors.push(`Failed to add relationship ${relData.fromTable} → ${relData.toTable}: ${error.message}`);
        }
      }
      
      // Apply note suggestions
      for (const noteData of suggestions.notes) {
        try {
          console.log("Adding note:", noteData);
          const noteId = nanoid();
          const newNote = {
            id: noteId,
            content: noteData.content,
            x: noteData.position?.x || 100 + (appliedCount * 200),
            y: noteData.position?.y || 100 + (appliedCount * 100),
            width: 200,
            height: 100,
            color: "#ffffcc"
          };
          
          addNote(newNote, true);
          console.log("Successfully added note:", newNote.content.substring(0, 50) + "...");
          appliedCount++;
        } catch (error) {
          console.error("Error adding note:", error);
          errors.push(`Failed to add note: ${error.message}`);
        }
      }
      
      // Show results
      if (appliedCount > 0) {
        addMessage({
          role: "ai",
          content: `✅ Successfully applied ${appliedCount} suggestions to the diagram!`
        });
      }
      
      if (errors.length > 0) {
        addMessage({
          role: "ai",
          content: `⚠️ Some suggestions could not be applied:\n${errors.join('\n')}`
        });
      }
      
      if (appliedCount === 0 && errors.length === 0) {
        // Check if the response contains general advice that could be actionable
        const hasGeneralAdvice = content.toLowerCase().includes('suggest') || 
                                content.toLowerCase().includes('recommend') || 
                                content.toLowerCase().includes('consider') ||
                                content.toLowerCase().includes('improve') ||
                                content.toLowerCase().includes('add') ||
                                content.toLowerCase().includes('missing') ||
                                content.toLowerCase().includes('note') ||
                                content.toLowerCase().includes('document') ||
                                content.toLowerCase().includes('spec');
        
        if (hasGeneralAdvice) {
          addMessage({
            role: "ai",
            content: "I found general advice in the response, but no specific suggestions that can be automatically applied. Try asking more specifically:\n\n• 'Suggest specific tables to add to improve this blog design'\n• 'What tables are missing for user authentication?'\n• 'Recommend specific relationships between blog_posts and other tables'\n• 'Add a user profile system with specific tables'\n• 'Add a spec document about the database design'\n• 'Create a note explaining the schema structure'"
          });
        } else {
          addMessage({
            role: "ai",
            content: "No actionable suggestions found in the response. For design reviews, try asking for specific improvements like 'suggest specific tables to add' or 'recommend specific relationships'."
          });
        }
      }
    } catch (error) {
      console.error("Failed to apply suggestion:", error);
      setErrorState("Failed to apply suggestion. Please try again.");
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  if (!isOpen) return null;

  return (
    <div className="ai-chat-panel open">
      {/* Header */}
      <div className="ai-chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <IconEdit size="large" />
          <Text className="ai-chat-title">{t("ai_assistant")}</Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {messages.length > 0 && (
            <Button
              type="tertiary"
              size="small"
              onClick={clearMessages}
              className="ai-chat-clear"
            >
              {t("ai_clear_chat")}
            </Button>
          )}
          <Button
            icon={<IconClose />}
            type="tertiary"
            size="small"
            onClick={closePanel}
            className="ai-chat-close"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "100%",
            textAlign: "center",
            color: "var(--semi-color-text-2)"
          }}>
            <IconEdit size="extra-large" style={{ marginBottom: "16px", opacity: 0.5 }} />
            {tables && tables.length > 0 ? (
              <>
                <Text>{t("ai_welcome_message")}</Text>
                <Text type="tertiary" style={{ marginTop: "8px" }}>
                  {t("ai_help_examples")}
                </Text>
              </>
            ) : (
              <>
                <Text>Welcome to AI Assistant!</Text>
                <Text type="tertiary" style={{ marginTop: "8px" }}>
                  Create some tables and relationships in your diagram first, then I can help you optimize and improve your database design.
                </Text>
              </>
            )}
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onApplySuggestion={handleApplySuggestion}
            onCopyCode={handleCopyCode}
          />
        ))}

        {isLoading && (
          <div className="ai-loading">
            <IconEdit size="small" />
            <span>{t("ai_generating")}</span>
            <div className="ai-loading-dots">
              <div className="ai-loading-dot"></div>
              <div className="ai-loading-dot"></div>
              <div className="ai-loading-dot"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="ai-error">
            <Text>{error}</Text>
            <Button
              size="small"
              onClick={() => {
                clearError();
                handleSendMessage();
              }}
              className="ai-error-retry"
            >
              {t("ai_retry")}
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-input">
        <div className="ai-input-container">
          <textarea
            ref={inputRef}
            id="ai-chat-input"
            name="ai-chat-input"
            className="ai-input-field"
            placeholder={tables && tables.length > 0 ? t("ai_chat_placeholder") : "Create tables first to get AI assistance"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!tables || tables.length === 0}
            rows={1}
            style={{
              minHeight: "40px",
              maxHeight: "120px",
              resize: "none"
            }}
          />
          <Button
            icon={<IconSend />}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || !tables || tables.length === 0}
            className="ai-send-button"
          />
        </div>
      </div>
    </div>
  );
}
