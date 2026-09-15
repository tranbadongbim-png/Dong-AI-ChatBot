import React, { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Sparkles,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  User,
  RotateCcw,
} from "lucide-react";
import { ChatMessage } from "../types";

interface MessageItemProps {
  message: ChatMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isLast,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThoughtOpen, setIsThoughtOpen] = useState(true);

  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = /[\u00C0-\u1EF9]/.test(message.content) ? "vi-VN" : "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex w-full gap-3 py-4 transition-colors ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar for Model */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      {/* Message Content Container */}
      <div
        className={`flex max-w-[88%] flex-col gap-1.5 md:max-w-[80%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Model info badge */}
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">
              Gemini 3.6 Flash
            </span>
            {message.fallbackReason && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 border border-blue-200" title={message.fallbackReason}>
                ⚡ {message.fallbackReason}
              </span>
            )}
            {message.thoughtProcess && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                <Brain className="h-3 w-3 text-amber-600" />
                Thinking
              </span>
            )}
          </div>
        )}

        {/* User attached images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.images.map((img) => (
              <div
                key={img.id}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xs"
              >
                <img
                  src={img.data}
                  alt={img.name || "Attached"}
                  className="max-h-48 max-w-xs object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Thought Process Accordion */}
        {!isUser && message.thoughtProcess && (
          <div
            id={`thought-process-${message.id}`}
            className="w-full overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 text-slate-800 transition-all mb-1"
          >
            <button
              onClick={() => setIsThoughtOpen(!isThoughtOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100/60"
            >
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-amber-600" />
                <span>Quá trình suy luận (Thinking Process)</span>
                {message.isStreaming && !message.content && (
                  <span className="animate-pulse text-[11px] font-normal text-amber-600">
                    • Đang suy nghĩ sâu...
                  </span>
                )}
              </div>
              {isThoughtOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {isThoughtOpen && (
              <div className="border-t border-amber-200 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-mono text-[11px] bg-white/70 max-h-60 overflow-y-auto">
                {message.thoughtProcess}
              </div>
            )}
          </div>
        )}

        {/* Main Text Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
            isUser
              ? "rounded-tr-xs bg-blue-600 text-white font-normal"
              : message.error
              ? "rounded-tl-xs border border-red-200 bg-red-50 text-red-900"
              : "rounded-tl-xs border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {message.error && (
            <div className="mb-2 flex items-center gap-1.5 font-bold text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Đã xảy ra lỗi</span>
            </div>
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm max-w-none break-words text-slate-800 prose-headings:text-slate-900 prose-p:leading-relaxed prose-strong:text-slate-900">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <div className="relative my-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-800 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        <span>Code</span>
                      </div>
                      <pre className="overflow-x-auto p-3 text-xs font-mono text-slate-800 bg-white">{children}</pre>
                    </div>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className && typeof children === "string";
                    if (isInline) {
                      return (
                        <code
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-medium text-pink-600 border border-slate-200"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return <code {...props}>{children}</code>;
                  },
                  table: ({ children }) => (
                    <div className="my-2.5 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-slate-200 bg-slate-50 p-2 font-semibold text-slate-900">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-slate-100 p-2 text-slate-700 bg-white">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content || (message.isStreaming ? "..." : "")}
              </Markdown>
            </div>
          )}

          {/* Streaming blinking cursor */}
          {message.isStreaming && !isUser && (
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-blue-500 ml-1 align-middle" />
          )}
        </div>

        {/* Message Actions */}
        {!isUser && !message.isStreaming && (
          <div className="mt-1 flex items-center gap-2 px-1 text-slate-500 opacity-90 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              title="Sao chép nội dung"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 hover:text-slate-800"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px] text-emerald-600 font-medium">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px]">Sao chép</span>
                </>
              )}
            </button>

            {"speechSynthesis" in window && (
              <button
                onClick={handleSpeak}
                title={isSpeaking ? "Dừng đọc" : "Đọc nội dung"}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  isSpeaking
                    ? "bg-blue-50 text-blue-600"
                    : "hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 animate-pulse text-blue-600" />
                    <span className="text-[11px] font-medium text-blue-600">Dừng</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[11px]">Đọc</span>
                  </>
                )}
              </button>
            )}

            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Tạo lại câu trả lời"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 hover:text-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px]">Tạo lại</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avatar for User */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-slate-200 text-slate-700 shadow-xs">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
