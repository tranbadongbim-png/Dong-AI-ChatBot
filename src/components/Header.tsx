import React from "react";
import { Brain, Zap, Sparkles, Plus, Trash2, Sliders, Menu } from "lucide-react";

interface HeaderProps {
  enableThinking: boolean;
  onToggleThinking: (enabled: boolean) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  hasMessages: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  enableThinking,
  onToggleThinking,
  selectedModel,
  onSelectModel,
  onNewChat,
  onClearChat,
  onOpenSettings,
  onToggleSidebar,
  hasMessages,
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                Gemini 3.8
              </h1>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                AI Studio
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Google Gemini 3.8 Flash &amp; High Thinking Reasoning
            </p>
          </div>
        </div>
      </div>

      {/* Model & Thinking Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* High Thinking Toggle */}
        <button
          id="btn-toggle-thinking"
          onClick={() => onToggleThinking(!enableThinking)}
          title={
            enableThinking
              ? "Chế độ suy luận sâu đang bật (gemini-3.1-pro-preview)"
              : "Bật chế độ High Thinking để xử lý câu hỏi phức tạp"
          }
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            enableThinking
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40"
              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Brain className={`h-4 w-4 ${enableThinking ? "animate-pulse" : "text-amber-500"}`} />
          <span className="hidden sm:inline">High Thinking</span>
          <span className="text-[10px] opacity-90">
            {enableThinking ? "BẬT" : "TẮT"}
          </span>
        </button>

        {/* Model Selector Dropdown */}
        <div className="relative hidden md:block">
          <select
            id="select-model-dropdown"
            value={selectedModel}
            onChange={(e) => {
              onSelectModel(e.target.value);
            }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (Mới nhất)</option>
            <option value="gemini-3.6-flash">Gemini 3.6 Flash (Tốc độ cao &amp; Ổn định)</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview - Cần Paid Key)</option>
          </select>
        </div>

        {/* Action buttons */}
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          title="Tạo cuộc trò chuyện mới"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Đoạn chat mới</span>
        </button>

        {hasMessages && (
          <button
            id="btn-header-clear-chat"
            onClick={onClearChat}
            title="Xóa lịch sử cuộc trò chuyện hiện tại"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          title="Tùy chỉnh Prompt hệ thống"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
