import React, { useState, useEffect } from "react";
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
  FileText,
  FileCode,
  Globe,
  ExternalLink,
  Search,
} from "lucide-react";
import { ChatMessage } from "../types";

interface MessageItemProps {
  message: ChatMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}

const getModelDisplayName = (modelId?: string) => {
  if (!modelId) return "Gemini 3.6 Flash";
  if (modelId === "pyrevit-code-pro" || modelId === "pyrevit-code-specialist") return "⚡ pyRevit Pro Coder";
  if (modelId === "gemini-3.6-flash") return "Gemini 3.6 Flash";
  if (modelId === "gemini-3.5-flash-lite") return "Gemini 3.5 Flash Lite";
  if (modelId === "gemini-3.1-flash-lite" || modelId === "gemini-flash-lite-latest") return "Gemini Flash Lite";
  if (modelId === "gemini-3.5-flash") return "Gemini 3.5 Flash";
  if (modelId === "gemini-3.8-flash") return "Gemini 3.8 Flash";
  if (modelId === "gemini-2.5-flash") return "Gemini 2.5 Flash";
  if (modelId === "gemini-2.5-pro") return "Gemini 2.5 Pro";
  return modelId
    .replace(/^models\//, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const extractDomain = (urlStr: string): string => {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
};

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    const getText = (node: React.ReactNode): string => {
      if (typeof node === "string" || typeof node === "number") {
        return String(node);
      }
      if (Array.isArray(node)) {
        return node.map(getText).join("");
      }
      if (React.isValidElement(node) && (node.props as any)?.children) {
        return getText((node.props as any).children);
      }
      return "";
    };

    const codeText = getText(children);
    if (codeText) {
      try {
        await navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy code block", err);
      }
    }
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-100 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-400">
        <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5 text-blue-400" />
          Mã nguồn pyRevit / Python / XAML
        </span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
          title="Sao chép toàn bộ khung code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Đã copy code!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-xs font-mono text-slate-100 bg-slate-900 leading-relaxed">
        {children}
      </pre>
    </div>
  );
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isLast,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThoughtOpen, setIsThoughtOpen] = useState(true);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  // Live thinking timer while streaming
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStreaming && !message.content) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setThinkingSeconds(
          Math.max(1, Math.floor((Date.now() - startTime) / 1000))
        );
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, message.content]);

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
        <div
          className={`relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl text-white shadow-xs transition-all ${
            isStreaming
              ? "bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 ring-2 ring-blue-400/40 animate-pulse"
              : "bg-gradient-to-tr from-blue-600 to-indigo-600"
          }`}
        >
          {isStreaming && !message.content ? (
            <Sparkles className="h-4 w-4 animate-spin text-white" style={{ animationDuration: "3s" }} />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </div>
      )}

      {/* Message Content Container */}
      <div
        className={`flex max-w-[90%] flex-col gap-1.5 md:max-w-[82%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Model info badge */}
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              {getModelDisplayName(message.modelUsed)}
            </span>
            {message.fallbackReason && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 border border-blue-200"
                title={message.fallbackReason}
              >
                ⚡ {message.fallbackReason}
              </span>
            )}
            {message.thoughtProcess && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                <Brain className="h-3 w-3 text-amber-600" />
                Thinking Mode
              </span>
            )}
            {(message.groundingSources && message.groundingSources.length > 0) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <Globe className="h-3 w-3 text-emerald-600" />
                Google Search
              </span>
            )}
            {isStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                Đang phản hồi...
              </span>
            )}
          </div>
        )}

        {/* User attached files (Images, PDFs, Python, Code, XAML) */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.images.map((img) => {
              const isImg = img.fileType === "image" || img.mimeType?.startsWith("image/");
              const isPdf = img.fileType === "pdf" || img.mimeType === "application/pdf" || img.name?.toLowerCase().endsWith(".pdf");
              const isPy = img.name?.toLowerCase().endsWith(".py");
              const isXaml = img.name?.toLowerCase().endsWith(".xaml");

              if (isImg) {
                return (
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
                );
              }

              if (isPdf) {
                return (
                  <div
                    key={img.id}
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-950 shadow-xs max-w-xs"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-red-900">{img.name}</p>
                      <p className="text-[10px] text-red-600 font-semibold uppercase">
                        Tài liệu PDF {img.size ? `• ${(img.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                  </div>
                );
              }

              if (isXaml) {
                return (
                  <div
                    key={img.id}
                    className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/80 px-3 py-2 text-xs text-purple-950 shadow-xs max-w-xs"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shrink-0">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-purple-900">{img.name}</p>
                      <p className="text-[10px] text-purple-700 font-semibold uppercase">
                        Giao diện XAML (.xaml) {img.size ? `• ${(img.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={img.id}
                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-950 shadow-xs max-w-xs"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0 ${isPy ? "bg-amber-600" : "bg-blue-600"}`}>
                    <FileCode className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate text-slate-900">{img.name}</p>
                    <p className="text-[10px] text-blue-700 font-semibold uppercase">
                      {isPy ? "Mã nguồn Python (.py)" : "Mã nguồn / Văn bản"} {img.size ? `• ${(img.size / 1024).toFixed(0)} KB` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thought Process Accordion */}
        {!isUser && message.thoughtProcess && (
          <div
            id={`thought-process-${message.id}`}
            className={`w-full overflow-hidden rounded-xl border transition-all mb-1 ${
              isStreaming && !message.content
                ? "border-amber-400/80 bg-amber-50/80 ring-2 ring-amber-300/40 shadow-sm"
                : "border-amber-200 bg-amber-50/70 text-slate-800"
            }`}
          >
            {/* Thinking Progress Bar when streaming */}
            {isStreaming && (
              <div className="h-0.5 w-full gemini-thinking-border" />
            )}

            <button
              onClick={() => setIsThoughtOpen(!isThoughtOpen)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-amber-950 hover:bg-amber-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-200/80 text-amber-800">
                  <Brain className={`h-3.5 w-3.5 ${isStreaming ? "animate-pulse" : ""}`} />
                </div>
                <span>Quá trình suy luận (Thinking Process)</span>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-900 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-ping" />
                    Đang bóc tách logic...
                  </span>
                )}
              </div>
              {isThoughtOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-amber-800" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-amber-800" />
              )}
            </button>

            {isThoughtOpen && (
              <div className="border-t border-amber-200/80 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-mono text-[11px] bg-white/80 max-h-64 overflow-y-auto">
                {message.thoughtProcess}
                {isStreaming && !message.content && (
                  <span className="inline-block h-3.5 w-1.5 animate-pulse bg-amber-600 ml-1 align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Gemini Thinking Loading State */}
        {!isUser && isStreaming && !message.content && !message.thoughtProcess && (
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 p-4 shadow-sm">
            {/* Top animated rainbow border */}
            <div className="absolute inset-x-0 top-0 h-1 gemini-thinking-border" />

            <div className="flex items-center gap-3">
              {/* Gemini pulsating Wave Bars */}
              <div className="flex items-center gap-1 h-6">
                <span className="w-1 rounded-full bg-blue-600 wave-bar-1" />
                <span className="w-1 rounded-full bg-indigo-600 wave-bar-2" />
                <span className="w-1 rounded-full bg-purple-600 wave-bar-3" />
                <span className="w-1 rounded-full bg-pink-500 wave-bar-4" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Gemini đang suy nghĩ & tìm kiếm...
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 font-mono">
                    ({thinkingSeconds > 0 ? `${thinkingSeconds}s` : "..."})
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {message.groundingSources && message.groundingSources.length > 0
                    ? "Đã tìm thấy thông tin mới nhất, đang tổng hợp câu trả lời..."
                    : thinkingSeconds > 4
                    ? "Đang tăng tốc kết nối mô hình tốc độ cao..."
                    : "Đang phân tích ngữ cảnh, kết nối dữ liệu mới nhất và tối ưu phản hồi..."}
                </p>
              </div>
            </div>

            {/* Shimmer skeleton lines */}
            <div className="mt-3 space-y-1.5">
              <div className="h-2 w-full rounded-full gemini-thinking-shimmer" />
              <div className="h-2 w-4/5 rounded-full gemini-thinking-shimmer" />
            </div>
          </div>
        )}

        {/* Main Text Bubble */}
        {(isUser || message.content || message.error) && (
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
                    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
                    code: ({ className, children, ...props }) => {
                      const isInline =
                        !className && typeof children === "string";
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
                        <table className="w-full text-left text-xs">
                          {children}
                        </table>
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
                  {message.content}
                </Markdown>
              </div>
            )}

            {/* Streaming blinking cursor */}
            {isStreaming && !isUser && (
              <span className="inline-block h-4 w-1.5 animate-pulse bg-gradient-to-b from-blue-600 to-indigo-600 rounded-xs ml-1 align-middle" />
            )}
          </div>
        )}

        {/* Google Search Grounding Sources Card (when web search was executed) */}
        {!isUser && (
          ((message.webSearchQueries && message.webSearchQueries.length > 0) ||
           (message.groundingSources && message.groundingSources.length > 0)) && (
            <div className="w-full mt-1.5 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-900">
                <Globe className="h-4 w-4 text-emerald-700" />
                <span>Nguồn thông tin từ Google Search:</span>
              </div>

              {/* Web Search Queries */}
              {message.webSearchQueries && message.webSearchQueries.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                    <Search className="h-3 w-3 text-emerald-600" />
                    Đã tìm:
                  </span>
                  {message.webSearchQueries.map((query, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-900 border border-emerald-200 shadow-2xs"
                    >
                      "{query}"
                    </span>
                  ))}
                </div>
              )}

              {/* Grounding Source Links */}
              {message.groundingSources && message.groundingSources.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {message.groundingSources.map((source, idx) => {
                    const domain = extractDomain(source.uri);
                    return (
                      <a
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2 text-xs text-slate-800 shadow-2xs transition-all hover:border-emerald-400 hover:bg-emerald-50/80 hover:shadow-xs group"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 shrink-0 group-hover:bg-emerald-200">
                          <Globe className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-slate-900 text-[11px] group-hover:text-emerald-900">
                            {source.title || domain}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {domain}
                          </p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-slate-400 shrink-0 group-hover:text-emerald-700" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* Message Actions */}
        {!isUser && !isStreaming && (
          <div className="mt-1 flex items-center gap-2 px-1 text-slate-500 opacity-90 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              title="Sao chép nội dung"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px] text-emerald-600 font-medium">
                    Đã sao chép
                  </span>
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
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
                  isSpeaking
                    ? "bg-blue-50 text-blue-600"
                    : "hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 animate-pulse text-blue-600" />
                    <span className="text-[11px] font-medium text-blue-600">
                      Dừng
                    </span>
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
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
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
