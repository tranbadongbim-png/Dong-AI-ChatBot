import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  Brain,
  X,
  UploadCloud,
  FileCode,
  FileText,
  File as GenericFileIcon,
  Paperclip,
} from "lucide-react";
import { ChatImage } from "../types";

interface ChatInputProps {
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
  isLoading: boolean;
  enableThinking: boolean;
  onToggleThinking: (enabled: boolean) => void;
}

// Helper to determine file category
function getFileCategory(file: File): {
  category: "image" | "pdf" | "code" | "text";
  mimeType: string;
} {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || name.match(/\.(png|jpe?g|webp|gif|svg|bmp|ico)$/)) {
    return { category: "image", mimeType: file.type || "image/jpeg" };
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return { category: "pdf", mimeType: "application/pdf" };
  }
  if (
    name.match(/\.(xaml|py|js|ts|tsx|jsx|cpp|c|h|hpp|cs|java|go|rs|php|rb|swift|kt|sql|sh|bash|zsh|ps1|json|xml|yaml|yml|html|css|scss|md|markdown|env|toml|ini|dockerfile|ipynb|vue|svelte|dart|r|lua)$/) ||
    file.type.startsWith("text/x-") ||
    file.type === "application/json" ||
    file.type === "application/javascript" ||
    file.type === "application/xml"
  ) {
    return { category: "code", mimeType: file.type || "application/xml" };
  }
  return { category: "text", mimeType: file.type || "text/plain" };
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isLoading,
  enableThinking,
  onToggleThinking,
}) => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [text]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      const { category, mimeType } = getFileCategory(file);

      // Handle Code & Text files (e.g. .xaml, .py, .ts, .json, .txt)
      if (category === "code" || category === "text") {
        const textReader = new FileReader();
        textReader.onload = () => {
          const content = (textReader.result as string) || "";
          setAttachments((prev) => {
            // Deduplicate by name & size
            if (prev.some((a) => a.name === file.name && a.size === file.size)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                data: content,
                mimeType,
                name: file.name,
                size: file.size,
                fileType: category,
                textContent: content,
              },
            ];
          });
        };
        textReader.onerror = () => {
          console.error("Lỗi khi đọc tệp văn bản:", file.name);
        };
        textReader.readAsText(file, "utf-8");
        return;
      }

      // Handle PDF and Images via readAsDataURL
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        setAttachments((prev) => {
          if (prev.some((a) => a.name === file.name && a.size === file.size)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              data: base64String,
              mimeType,
              name: file.name || `${category}_${Date.now()}`,
              size: file.size,
              fileType: category,
            },
          ];
        });
      };
      reader.onerror = () => {
        console.error("Lỗi khi đọc tệp đa phương tiện:", file.name);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Window-level Drag and Drop Listeners with strict anti-flickering drag counter
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounterRef.current += 1;
        if (dragCounterRef.current === 1) {
          setIsDragging(true);
        }
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [addFiles]);

  // Handle Clipboard Paste (Ctrl+V / Cmd+V / Screenshot / Copied files)
  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const targetFiles: File[] = [];

    // Prefer items
    if (clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            targetFiles.push(file);
          }
        }
      }
    } else if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        targetFiles.push(clipboardData.files[i]);
      }
    }

    if (targetFiles.length > 0) {
      addFiles(targetFiles);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && attachments.length === 0) || isLoading) return;

    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const isPythonFile = (name: string) => name.toLowerCase().endsWith(".py");
  const isXamlFile = (name: string) => name.toLowerCase().endsWith(".xaml");
  const isPdfFile = (name: string, type?: string) =>
    name.toLowerCase().endsWith(".pdf") || type === "pdf";

  return (
    <div className="relative mx-auto w-full max-w-4xl px-3 sm:px-4 pb-3 sm:pb-4 bg-white shrink-0">
      {/* Non-flickering full-area Drop Overlay with pointer-events-none */}
      {isDragging && (
        <div className="pointer-events-none select-none absolute inset-x-3 sm:inset-x-4 inset-y-0 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/95 shadow-xl backdrop-blur-xs transition-all animate-in fade-in duration-150">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-xs mb-2">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-blue-900">
            Thả tệp vào đây để Gemini 3.6 đọc & phân tích
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            Hỗ trợ .xaml, .py, PDF, Code (.ts, .js, .json, .cs...), Hình ảnh
          </p>
        </div>
      )}

      {/* Uploaded attachments preview bar */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-xs">
          {attachments.map((att) => {
            const isPy = isPythonFile(att.name);
            const isXaml = isXamlFile(att.name);
            const isPdf = isPdfFile(att.name, att.fileType);
            const isImg = att.fileType === "image" || att.mimeType?.startsWith("image/");

            return (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-7 shadow-xs transition-all hover:border-slate-300"
              >
                {/* Visual Icon / Thumbnail */}
                {isImg ? (
                  <div className="h-8 w-8 overflow-hidden rounded border border-slate-200 bg-slate-100 shrink-0">
                    <img
                      src={att.data}
                      alt={att.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : isPdf ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-red-100 text-red-600 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                ) : isXaml ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-100 text-purple-700 font-bold text-[10px] shrink-0">
                    <FileCode className="h-4 w-4 text-purple-600" />
                  </div>
                ) : isPy ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-100 text-amber-700 font-bold text-[10px] shrink-0">
                    <FileCode className="h-4 w-4 text-amber-700" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-700 shrink-0">
                    <GenericFileIcon className="h-4 w-4" />
                  </div>
                )}

                {/* File details */}
                <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[180px]">
                  <span className="truncate text-xs font-semibold text-slate-800">
                    {att.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="font-medium text-slate-500 uppercase">
                      {isXaml
                        ? "XAML (.xaml)"
                        : isPy
                        ? "Python (.py)"
                        : isPdf
                        ? "Tài liệu PDF"
                        : isImg
                        ? "Hình ảnh"
                        : "Mã nguồn"}
                    </span>
                    {att.size && <span>• {formatFileSize(att.size)}</span>}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  title="Xóa tệp đính kèm"
                  className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition-colors hover:bg-red-500 hover:text-white cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <div className="text-[11px] text-slate-500 pl-1 whitespace-nowrap">
            Đã đính kèm {attachments.length} tệp
          </div>
        </div>
      )}

      {/* Input container */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 hover:border-slate-400">
        <textarea
          ref={textareaRef}
          id="chat-input-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            enableThinking
              ? "Hỏi bài toán, yêu cầu đọc tệp .xaml / .py / PDF hoặc suy luận sâu... (kéo thả hoặc dán tệp trực tiếp)"
              : "Hỏi Gemini bất kỳ điều gì, hoặc kéo thả tệp .xaml, .py, PDF, hình ảnh, mã nguồn..."
          }
          rows={1}
          className="max-h-48 w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
        />

        {/* Action bar inside textarea */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Hidden file input accepting images, pdfs, xaml, and code/text */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xaml,.py,.pdf,.txt,.json,.csv,.md,.js,.ts,.tsx,.jsx,.cpp,.c,.java,.go,.rs,.sql,.sh,.yaml,.yml,.xml,image/png,image/jpeg,image/webp,image/gif,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload-input"
            />

            {/* Attach File button */}
            <button
              type="button"
              id="btn-attach-files"
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm tệp (.xaml, .py, PDF, Code, Ảnh) hoặc Dán (Ctrl+V)"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-100 active:scale-95 cursor-pointer"
            >
              <Paperclip className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Đính kèm .xaml / .py / PDF / Ảnh</span>
            </button>

            {/* Quick High Thinking toggle */}
            <button
              type="button"
              id="btn-input-toggle-thinking"
              onClick={() => onToggleThinking(!enableThinking)}
              title="Bật/Tắt chế độ High Thinking (ThinkingLevel.HIGH)"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                enableThinking
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Brain className={`h-4 w-4 shrink-0 ${enableThinking ? "text-amber-600" : "text-slate-400"}`} />
              <span className="hidden sm:inline whitespace-nowrap">Suy luận sâu</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLoading ? (
              <button
                type="button"
                id="btn-stop-stream"
                onClick={onStop}
                title="Dừng phản hồi"
                className="flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs whitespace-nowrap shrink-0 hover:bg-slate-800 active:scale-95 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current shrink-0" />
                <span className="whitespace-nowrap">Dừng</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-send-message"
                onClick={() => handleSubmit()}
                disabled={!text.trim() && attachments.length === 0}
                title="Gửi câu hỏi (Enter)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 px-1 text-[11px] text-slate-400">
        <span className="whitespace-nowrap">
          Hỗ trợ kéo thả hoặc dán <strong className="font-semibold text-slate-600">.xaml, .py, PDF, Code, Ảnh (Ctrl + V)</strong>
        </span>
        <span className="hidden sm:inline whitespace-nowrap">Shift + Enter để xuống dòng</span>
      </div>
    </div>
  );
};
