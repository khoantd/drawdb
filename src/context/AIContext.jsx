import { createContext, useState, useCallback, useEffect } from "react";
import { useSettings } from "../hooks";

export const AIContext = createContext(null);

export default function AIContextProvider({ children }) {
  const { settings } = useSettings();
  
  // Chat state - initialize from localStorage
  const [messages, setMessages] = useState(() => {
    try {
      const savedMessages = localStorage.getItem('ai-chat-history');
      return savedMessages ? JSON.parse(savedMessages) : [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  
  // AI configuration - initialize from settings
  const [aiConfig, setAiConfig] = useState({
    enabled: settings.aiEnabled || false,
    endpoint: settings.aiEndpoint || "",
    apiKey: settings.aiApiKey || "",
    model: settings.aiModel || "gpt-3.5-turbo"
  });

  // Update AI config when settings change
  useEffect(() => {
    const newConfig = {
      enabled: settings.aiEnabled || false,
      endpoint: settings.aiEndpoint || "",
      apiKey: settings.aiApiKey || "",
      model: settings.aiModel || "gpt-3.5-turbo"
    };
    console.log("Updating AI config from settings:", newConfig);
    setAiConfig(newConfig);
  }, [settings.aiEnabled, settings.aiEndpoint, settings.aiApiKey, settings.aiModel]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ai-chat-history', JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }, [messages]);

  // Add message to chat
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      ...message,
      timestamp: new Date()
    }]);
  }, []);

  // Clear chat history
  const clearMessages = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem('ai-chat-history');
    } catch (error) {
      console.error('Error clearing chat history from localStorage:', error);
    }
  }, []);

  // Update AI configuration
  const updateAiConfig = useCallback((newConfig) => {
    setAiConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Toggle AI panel
  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Close AI panel
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Set loading state
  const setLoading = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Set error state
  const setErrorState = useCallback((error) => {
    setError(error);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Export chat history
  const exportChatHistory = useCallback(() => {
    try {
      const dataStr = JSON.stringify(messages, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-chat-history-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat history:', error);
    }
  }, [messages]);

  // Import chat history
  const importChatHistory = useCallback((file) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const importedMessages = JSON.parse(e.target.result);
        setMessages(importedMessages);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing chat history:', error);
    }
  }, []);

  return (
    <AIContext.Provider
      value={{
        // State
        messages,
        isLoading,
        isOpen,
        error,
        aiConfig,
        
        // Actions
        addMessage,
        clearMessages,
        updateAiConfig,
        togglePanel,
        closePanel,
        setLoading,
        setErrorState,
        clearError,
        exportChatHistory,
        importChatHistory
      }}
    >
      {children}
    </AIContext.Provider>
  );
}
