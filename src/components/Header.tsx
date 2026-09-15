import React from "react";
import { Brain, Zap, Sparkles, Plus, Trash2, Sliders, Menu, Key } from "lucide-react";

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
  hasApiKey?: boolean;
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
  hasApiKey,
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                Gemini 3.6 Flash
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Miễn phí &amp; Không giới hạn
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">
              Google Gemini 3.6 Flash - Tốc độ cao &amp; Ổn định nhất
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
              ? "Chế độ suy luận sâu đang bật"
              : "Bật chế độ High Thinking để xử lý câu hỏi phức tạp"
          }
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            enableThinking
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50"
              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
          }`}
        >
          <Brain className={`h-4 w-4 ${enableThinking ? "animate-pulse" : "text-amber-600"}`} />
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
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:border-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="gemini-3.6-flash">Gemini 3.6 Flash (Tốc độ cao)</option>
          </select>
        </div>

        {/* Action buttons */}
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          title="Tạo cuộc trò chuyện mới"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:border-slate-300"
        >
          <Plus className="h-4 w-4 text-blue-600" />
          <span className="hidden sm:inline">Đoạn chat mới</span>
        </button>

        {hasMessages && (
          <button
            id="btn-header-clear-chat"
            onClick={onClearChat}
            title="Xóa lịch sử cuộc trò chuyện hiện tại"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          title={hasApiKey ? "Cài đặt & Quản lý API Key (Đã kích hoạt)" : "Cài đặt & Nhập API Key"}
          className={`relative flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors ${
            hasApiKey
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{hasApiKey ? "API Key OK" : "Cài đặt"}</span>
          {hasApiKey && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
