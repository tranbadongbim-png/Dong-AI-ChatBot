import React, { useRef, useState, useEffect } from "react";
import {
  Send,
  Square,
  Image as ImageIcon,
  Brain,
  X,
  Sparkles,
  Zap,
} from "lucide-react";
import { ChatImage } from "../types";

interface ChatInputProps {
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
  isLoading: boolean;
  enableThinking: boolean;
  onToggleThinking: (enabled: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isLoading,
  enableThinking,
  onToggleThinking,
}) => {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ChatImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && images.length === 0) || isLoading) return;

    onSend(text.trim(), images);
    setText("");
    setImages([]);
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

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        setImages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            data: base64String,
            mimeType: file.type,
            name: file.name,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 pb-4">
      {/* Uploaded image previews */}
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          {images.map((img) => (
            <div key={img.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <img
                src={img.data}
                alt={img.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/70 text-white transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900">
        <textarea
          ref={textareaRef}
          id="chat-input-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            enableThinking
              ? "Đặt câu hỏi phức tạp (chế độ suy luận sâu High Thinking đang kích hoạt)..."
              : "Hỏi Gemini 3.8 bất kỳ điều gì hoặc tải ảnh lên để phân tích..."
          }
          rows={1}
          className="max-h-48 w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
        />

        {/* Action bar inside textarea */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload-input"
            />

            {/* Attach Image button */}
            <button
              type="button"
              id="btn-attach-image"
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm hình ảnh để Gemini 3.8 phân tích"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ImageIcon className="h-4 w-4 text-blue-500" />
              <span className="hidden sm:inline">Thêm ảnh</span>
            </button>

            {/* Quick High Thinking toggle */}
            <button
              type="button"
              id="btn-input-toggle-thinking"
              onClick={() => onToggleThinking(!enableThinking)}
              title="Bật/Tắt chế độ High Thinking (ThinkingLevel.HIGH)"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
                enableThinking
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-400/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/40"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Brain className={`h-4 w-4 ${enableThinking ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} />
              <span className="hidden sm:inline">Suy luận sâu</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <button
                type="button"
                id="btn-stop-stream"
                onClick={onStop}
                title="Dừng phản hồi"
                className="flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-medium text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Dừng</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-send-message"
                onClick={() => handleSubmit()}
                disabled={!text.trim() && images.length === 0}
                title="Gửi câu hỏi (Enter)"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-slate-500">
        <span>
          Mô hình:{" "}
          <strong className="font-medium text-slate-600 dark:text-slate-400">
            {enableThinking ? "High Thinking (Suy luận sâu)" : "Gemini Flash"}
          </strong>
        </span>
        <span className="hidden sm:inline">Shift + Enter để xuống dòng</span>
      </div>
    </div>
  );
};
