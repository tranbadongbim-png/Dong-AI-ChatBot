import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { MessageItem } from "./components/MessageItem";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
import { SettingsModal } from "./components/SettingsModal";
import { ChatImage, ChatMessage, ChatSession, PresetPrompt } from "./types";

const STORAGE_KEY = "gemini_38_sessions_v1";

function createNewSession(enableThinking: boolean, model: string): ChatSession {
  return {
    id: "session_" + Date.now().toString(36),
    title: "Đoạn chat mới",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: model || "gemini-3.8-flash",
    enableThinking,
  };
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
    return [createNewSession(false, "gemini-3.8-flash")];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id || ""
  );

  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.8-flash");
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active session helper
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions", e);
    }
  }, [sessions]);

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
    forcedModel?: string
  ) => {
    const isThinkingMode =
      typeof forcedThinking === "boolean" ? forcedThinking : enableThinking;
    const modelToUse = forcedModel || selectedModel || "gemini-3.8-flash";

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
        images: m.images?.map((img) => ({
          data: img.data,
          mimeType: img.mimeType,
        })),
      }));

      const payload = {
        prompt,
        history,
        images: images.map((img) => ({
          data: img.data,
          mimeType: img.mimeType,
        })),
        enableThinking: isThinkingMode,
        model: modelToUse,
        systemInstruction: systemInstruction || undefined,
      };

      const response = await fetch("/api/gemini/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Yêu cầu thất bại với mã trạng thái ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Không thể đọc luồng dữ liệu từ máy chủ.");

      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let accumulatedThought = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();

          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
            }
            if (parsed.thought) {
              accumulatedThought += parsed.thought;
            }
            const currentModel = parsed.model;
            const fallbackReason = parsed.fallbackReason;

            // Update model message
            updateActiveSessionMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId
                  ? {
                      ...msg,
                      content: accumulatedText,
                      thoughtProcess: accumulatedThought,
                      modelUsed: currentModel || msg.modelUsed,
                      fallbackReason: fallbackReason || msg.fallbackReason,
                      isStreaming: true,
                    }
                  : msg
              )
            );
          } catch (e: any) {
            console.error("SSE parse or API error:", e);
            throw e;
          }
        }
      }

      // Mark streaming completed
      updateActiveSessionMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? {
                ...msg,
                content: accumulatedText || "Đã nhận phản hồi từ Gemini.",
                thoughtProcess: accumulatedThought,
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

  const handleNewSession = () => {
    const newSess = createNewSession(enableThinking, selectedModel);
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createNewSession(enableThinking, selectedModel);
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearCurrentChat = () => {
    updateActiveSessionMessages(() => []);
  };

  const handleSelectPreset = (preset: PresetPrompt) => {
    if (preset.enableThinking) {
      setEnableThinking(true);
    }
    handleSendMessage(
      preset.prompt,
      [],
      preset.enableThinking,
      preset.model
    );
  };

  const handleRegenerateLast = () => {
    if (messages.length < 2) return;
    // Find last user message
    let lastUserMsg: ChatMessage | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMsg = messages[i];
        break;
      }
    }
    if (!lastUserMsg) return;

    // Remove last model message
    updateActiveSessionMessages((prev) => prev.slice(0, -1));
    handleSendMessage(lastUserMsg.content, lastUserMsg.images || []);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar for session management */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        enableThinking={enableThinking}
        onToggleThinking={setEnableThinking}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
        {/* Top Header */}
        <Header
          enableThinking={enableThinking}
          onToggleThinking={setEnableThinking}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onNewChat={handleNewSession}
          onClearChat={handleClearCurrentChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          hasMessages={messages.length > 0}
        />

        {/* Messages List / Empty State */}
        <main
          id="chat-messages-container"
          className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
        >
          {messages.length === 0 ? (
            <EmptyState
              onSelectPreset={handleSelectPreset}
              enableThinking={enableThinking}
              onToggleThinking={setEnableThinking}
            />
          ) : (
            <div className="mx-auto max-w-4xl divide-y divide-slate-100 dark:divide-slate-800/60">
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
          onToggleThinking={setEnableThinking}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        systemInstruction={systemInstruction}
        onSaveSystemInstruction={setSystemInstruction}
      />
    </div>
  );
}
