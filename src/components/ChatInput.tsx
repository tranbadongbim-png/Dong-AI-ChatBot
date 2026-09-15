import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  Image as ImageIcon,
  Brain,
  X,
  UploadCloud,
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
  const [isDragging, setIsDragging] = useState(false);
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

  const addImageFiles = useCallback((files: FileList | File[]) => {
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
            name: file.name || `Pasted_Image_${Date.now()}`,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle Clipboard Paste (Ctrl+V / Cmd+V / Screenshot)
  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const imageFiles: File[] = [];

    // Check items
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }
    }

    // Check files
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type.startsWith("image/") && !imageFiles.includes(file)) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      addImageFiles(imageFiles);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImageFiles(e.dataTransfer.files);
    }
  };

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
    addImageFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div
      className="relative mx-auto w-full max-w-4xl px-3 sm:px-4 pb-3 sm:pb-4 bg-white shrink-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-x-3 sm:inset-x-4 inset-y-0 z-30 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/95 backdrop-blur-xs transition-all">
          <UploadCloud className="h-10 w-10 text-blue-600 animate-bounce" />
          <p className="mt-2 text-sm font-bold text-blue-900 whitespace-nowrap">
            Thả hình ảnh vào đây để tải lên
          </p>
          <p className="text-xs text-blue-600 whitespace-nowrap">
            Hỗ trợ dán ảnh (Ctrl+V) hoặc kéo thả trực tiếp
          </p>
        </div>
      )}

      {/* Uploaded image previews */}
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-xs">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs shrink-0"
            >
              <img
                src={img.data}
                alt={img.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                title="Xóa ảnh"
                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-white transition-opacity hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="text-[11px] text-slate-500 pl-1 whitespace-nowrap">
            Đã đính kèm {images.length} hình ảnh (dán tiếp bằng Ctrl+V)
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
              ? "Hỏi bài toán hoặc đặt câu hỏi suy luận sâu... Bạn có thể dán ảnh trực tiếp (Ctrl+V)"
              : "Hỏi Gemini bất kỳ điều gì hoặc dán ảnh trực tiếp (Ctrl+V) để phân tích..."
          }
          rows={1}
          className="max-h-48 w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
        />

        {/* Action bar inside textarea */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 shrink-0">
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
              title="Đính kèm hoặc Dán hình ảnh (Ctrl+V) để Gemini phân tích"
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-100 active:scale-95"
            >
              <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Tải / Dán ảnh</span>
            </button>

            {/* Quick High Thinking toggle */}
            <button
              type="button"
              id="btn-input-toggle-thinking"
              onClick={() => onToggleThinking(!enableThinking)}
              title="Bật/Tắt chế độ High Thinking (ThinkingLevel.HIGH)"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
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
                className="flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs whitespace-nowrap shrink-0 hover:bg-slate-800 active:scale-95"
              >
                <Square className="h-3.5 w-3.5 fill-current shrink-0" />
                <span className="whitespace-nowrap">Dừng</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-send-message"
                onClick={() => handleSubmit()}
                disabled={!text.trim() && images.length === 0}
                title="Gửi câu hỏi (Enter)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 px-1 text-[11px] text-slate-400">
        <span className="whitespace-nowrap">
          Hỗ trợ dán ảnh chụp màn hình <strong className="font-semibold text-slate-600">(Ctrl + V)</strong> hoặc kéo thả
        </span>
        <span className="hidden sm:inline whitespace-nowrap">Shift + Enter để xuống dòng</span>
      </div>
    </div>
  );
};
