import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { MessageItem } from "./components/MessageItem";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
import { SettingsModal } from "./components/SettingsModal";
import { GoogleAuthModal } from "./components/GoogleAuthModal";
import { ChatImage, ChatMessage, ChatSession, PresetPrompt, GoogleUser } from "./types";
import { sendChatMessage } from "./services/geminiClient";

const STORAGE_KEY_PREFIX = "gemini_36_sessions_";
const CURRENT_USER_KEY = "gemini_current_user_v1";
const API_KEY_STORAGE = "gemini_custom_api_key_v1";

function createNewSession(
  enableThinking: boolean,
  model: string,
  userId?: string,
  enableSearch: boolean = true
): ChatSession {
  return {
    id: "session_" + Date.now().toString(36),
    title: "Đoạn chat mới",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: model || "gemini-3.6-flash",
    enableThinking,
    enableSearch,
    userId,
  };
}

export default function App() {
  // Current User (Google Account)
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {
      console.error("Failed to load user", e);
    }
    return null;
  });

  const getStorageKey = (user: GoogleUser | null) => {
    return user ? `${STORAGE_KEY_PREFIX}${user.id}` : `${STORAGE_KEY_PREFIX}guest`;
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const initialUser = (() => {
        try {
          const s = localStorage.getItem(CURRENT_USER_KEY);
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();
      const key = initialUser
        ? `${STORAGE_KEY_PREFIX}${initialUser.id}`
        : `${STORAGE_KEY_PREFIX}guest`;
      const saved = localStorage.getItem(key) || localStorage.getItem("gemini_36_sessions_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
    return [createNewSession(false, "gemini-3.6-flash", undefined, true)];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id || ""
  );

  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [enableSearch, setEnableSearch] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.6-flash");
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || "";
    } catch {
      return "";
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active session helper
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // Sync activeSession model, search, and thinking when activeSessionId changes
  useEffect(() => {
    if (activeSession) {
      if (activeSession.model) {
        const validModels = ["gemini-3.6-flash", "gemini-flash-lite-latest"];
        const safeModel = validModels.includes(activeSession.model)
          ? activeSession.model
          : "gemini-3.6-flash";
        setSelectedModel(safeModel);
      }
      if (typeof activeSession.enableThinking === "boolean") {
        setEnableThinking(activeSession.enableThinking);
      }
      if (typeof activeSession.enableSearch === "boolean") {
        setEnableSearch(activeSession.enableSearch);
      } else {
        setEnableSearch(true);
      }
    }
  }, [activeSessionId]);

  // Model selector change handler
  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, model } : s))
    );
  };

  // Thinking toggle handler
  const handleToggleThinking = (enabled: boolean) => {
    setEnableThinking(enabled);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, enableThinking: enabled } : s
      )
    );
  };

  // Search toggle handler
  const handleToggleSearch = (enabled: boolean) => {
    setEnableSearch(enabled);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, enableSearch: enabled } : s
      )
    );
  };

  // Persist sessions for the active user key
  useEffect(() => {
    try {
      const key = getStorageKey(currentUser);
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions", e);
    }
  }, [sessions, currentUser]);

  // Persist current user
  const handleLogin = (user: GoogleUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      const key = `${STORAGE_KEY_PREFIX}${user.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
      // If no prior session for this user, keep current or make fresh
      const fresh = createNewSession(enableThinking, selectedModel, user.id, enableSearch);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } catch (e) {
      console.error("Failed to login", e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
      const guestKey = `${STORAGE_KEY_PREFIX}guest`;
      const saved = localStorage.getItem(guestKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
      const fresh = createNewSession(enableThinking, selectedModel, undefined, enableSearch);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } catch (e) {
      console.error("Failed to logout", e);
    }
  };

  // Scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeSessionId]);

  useEffect(() => {
    if (isLoading) {
      scrollToBottom(true);
    }
  }, [messages, isLoading]);

  const updateActiveSessionMessages = (
    updater: (prevMessages: ChatMessage[]) => ChatMessage[]
  ) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id === activeSessionId) {
          const newMessages = updater(session.messages);
          // Auto title from first user message
          let title = session.title;
          if (
            session.title === "Đoạn chat mới" &&
            newMessages.length > 0 &&
            newMessages[0].role === "user"
          ) {
            title =
              newMessages[0].content.slice(0, 36) +
              (newMessages[0].content.length > 36 ? "..." : "");
          }
          return {
            ...session,
            messages: newMessages,
            updatedAt: Date.now(),
            title,
          };
        }
        return session;
      })
    );
  };

  const handleSendMessage = async (
    prompt: string,
    images: ChatImage[] = [],
    forcedThinking?: boolean,
    forcedModel?: string,
    forcedSearch?: boolean
  ) => {
    const isThinkingMode =
      typeof forcedThinking === "boolean" ? forcedThinking : enableThinking;
    const isSearchMode =
      typeof forcedSearch === "boolean" ? forcedSearch : enableSearch;
    const modelToUse = forcedModel || selectedModel || "gemini-3.6-flash";

    const userMessage: ChatMessage = {
      id: "msg_user_" + Date.now().toString(36),
      role: "user",
      content: prompt,
      images,
      timestamp: Date.now(),
    };

    const modelMessageId = "msg_model_" + (Date.now() + 1).toString(36);
    const initialModelMessage: ChatMessage = {
      id: modelMessageId,
      role: "model",
      content: "",
      thoughtProcess: "",
      timestamp: Date.now(),
      modelUsed: modelToUse,
      isStreaming: true,
    };

    // Add user message and empty model message
    updateActiveSessionMessages((prev) => [...prev, userMessage, initialModelMessage]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Prepare history (prior messages excluding current new user turn)
      const history = messages.map((m) => ({
        role: m.role,
        text: m.content,
        images: m.images,
      }));

      let accumulatedText = "";
      let accumulatedThought = "";
      let latestGroundingSources = undefined as any;
      let latestWebSearchQueries = undefined as any;

      await sendChatMessage({
        prompt,
        history,
        images,
        enableThinking: isThinkingMode,
        enableSearch: isSearchMode,
        model: modelToUse,
        systemInstruction,
        customApiKey,
        signal: abortController.signal,
        onChunk: ({ text, thought, model, fallbackReason, groundingSources, webSearchQueries }) => {
          if (text) accumulatedText += text;
          if (thought) accumulatedThought += thought;
          if (groundingSources) latestGroundingSources = groundingSources;
          if (webSearchQueries) latestWebSearchQueries = webSearchQueries;

          updateActiveSessionMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMessageId
                ? {
                    ...msg,
                    content: accumulatedText,
                    thoughtProcess: accumulatedThought,
                    modelUsed: model || msg.modelUsed,
                    fallbackReason: fallbackReason || msg.fallbackReason,
                    groundingSources: latestGroundingSources || msg.groundingSources,
                    webSearchQueries: latestWebSearchQueries || msg.webSearchQueries,
                    isStreaming: true,
                  }
                : msg
            )
          );
        },
      });

      // Mark streaming completed
      updateActiveSessionMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? {
                ...msg,
                content: accumulatedText || "Không nhận được nội dung phản hồi từ mô hình. Vui lòng bấm thử lại.",
                thoughtProcess: accumulatedThought,
                groundingSources: latestGroundingSources || msg.groundingSources,
                webSearchQueries: latestWebSearchQueries || msg.webSearchQueries,
                isStreaming: false,
              }
            : msg
        )
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateActiveSessionMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? {
                  ...msg,
                  content: msg.content + "\n\n*(Đã dừng tạo phản hồi)*",
                  isStreaming: false,
                }
              : msg
          )
        );
      } else {
        console.error("Chat error:", err);
        const errMsg = err?.message || "Đã xảy ra lỗi khi kết nối với Gemini API. Vui lòng thử lại.";
        updateActiveSessionMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId
              ? {
                  ...msg,
                  content: errMsg,
                  isStreaming: false,
                  error: true,
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerateLast = () => {
    if (isLoading || messages.length === 0) return;

    // Find the last model message and the user prompt preceding it
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "model") return;

    // Remove last model message
    const trimmed = messages.slice(0, -1);
    const lastUserMsg = trimmed[trimmed.length - 1];

    if (!lastUserMsg || lastUserMsg.role !== "user") return;

    // Remove last user message as well because handleSendMessage will append it
    const historyBeforeLastUser = trimmed.slice(0, -1);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: historyBeforeLastUser, updatedAt: Date.now() }
          : s
      )
    );

    // Resend
    handleSendMessage(
      lastUserMsg.content,
      lastUserMsg.images,
      enableThinking,
      selectedModel,
      enableSearch
    );
  };

  const handleNewSession = () => {
    if (isLoading) return;
    const newSession = createNewSession(
      enableThinking,
      selectedModel,
      currentUser?.id,
      enableSearch
    );
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    if (isLoading) return;
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sessions.length <= 1) {
      const fresh = createNewSession(
        enableThinking,
        selectedModel,
        currentUser?.id,
        enableSearch
      );
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  const handleClearChat = () => {
    if (isLoading) return;
    updateActiveSessionMessages(() => []);
  };

  const handleSelectPreset = (preset: PresetPrompt) => {
    if (isLoading) return;
    handleSendMessage(
      preset.prompt,
      [],
      preset.enableThinking,
      preset.model,
      true
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        enableThinking={enableThinking}
        onToggleThinking={handleToggleThinking}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0 bg-white shadow-xs">
        {/* Top Header */}
        <Header
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          enableThinking={enableThinking}
          onToggleThinking={handleToggleThinking}
          onNewChat={handleNewSession}
          onClearChat={handleClearChat}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          hasMessages={messages.length > 0}
          hasApiKey={Boolean(customApiKey)}
          currentUser={currentUser}
          onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
        />

        {/* Message View Area */}
        <main
          id="chat-messages-scroll-area"
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 scroll-smooth min-h-0"
        >
          {messages.length === 0 ? (
            <EmptyState
              onSelectPreset={handleSelectPreset}
              enableThinking={enableThinking}
              onToggleThinking={handleToggleThinking}
            />
          ) : (
            <div className="mx-auto max-w-4xl divide-y divide-slate-100">
              {messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  onRegenerate={
                    index === messages.length - 1 && message.role === "model"
                      ? handleRegenerateLast
                      : undefined
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Bar */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={handleStopStreaming}
          isLoading={isLoading}
          enableThinking={enableThinking}
          onToggleThinking={handleToggleThinking}
          enableSearch={enableSearch}
          onToggleSearch={handleToggleSearch}
        />
      </div>

      {/* Settings Modal (Custom API Key & System Instruction) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        systemInstruction={systemInstruction}
        onSaveSystemInstruction={setSystemInstruction}
        customApiKey={customApiKey}
        onSaveCustomApiKey={(key) => {
          setCustomApiKey(key);
          try {
            if (key) {
              localStorage.setItem(API_KEY_STORAGE, key);
            } else {
              localStorage.removeItem(API_KEY_STORAGE);
            }
          } catch (e) {
            console.error("Failed to persist API key", e);
          }
        }}
      />

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthOpen}
        onClose={() => setIsGoogleAuthOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        customApiKey={customApiKey}
        onSaveCustomApiKey={(key) => {
          setCustomApiKey(key);
          try {
            if (key) {
              localStorage.setItem(API_KEY_STORAGE, key);
            } else {
              localStorage.removeItem(API_KEY_STORAGE);
            }
          } catch (e) {
            console.error("Failed to persist API key", e);
          }
        }}
      />
    </div>
  );
}
