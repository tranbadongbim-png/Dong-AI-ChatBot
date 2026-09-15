import React from "react";
import { Brain, Sparkles, Plus, Trash2, Menu, Key, Cpu, BookOpen } from "lucide-react";
import { GoogleUser } from "../types";

interface HeaderProps {
  enableThinking: boolean;
  onToggleThinking: (enabled: boolean) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onOpenSettings: () => void;
  onOpenPyRevitContext: () => void;
  pyRevitDocCount: number;
  onToggleSidebar: () => void;
  hasMessages: boolean;
  hasApiKey?: boolean;
  currentUser: GoogleUser | null;
  onOpenGoogleAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  enableThinking,
  onToggleThinking,
  selectedModel,
  onSelectModel,
  onNewChat,
  onClearChat,
  onOpenSettings,
  onOpenPyRevitContext,
  pyRevitDocCount,
  onToggleSidebar,
  hasMessages,
  hasApiKey,
  currentUser,
  onOpenGoogleAuth,
}) => {
  const isPyRevitSelected = selectedModel === "pyrevit-code-pro" || selectedModel === "pyrevit-code-specialist" || selectedModel === "csharp-revit-pro" || selectedModel === "csharp-revit-coder";
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 shadow-xs backdrop-blur-md shrink-0 gap-3"
    >
      {/* Left Branding - Always fully visible, never squeezed */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-max">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                Gemini AI Studio
              </h1>
              <span className="hidden xl:inline-flex shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                Miễn phí &amp; Unlimited
              </span>
            </div>
            <p className="hidden 2xl:block text-[11px] text-slate-500 whitespace-nowrap">
              Google Gemini Multi-Model
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls Bar - Compact, neatly spaced & zero-wrap */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Model Selector Dropdown - Compact & Clean */}
        <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-2 h-8 transition-colors shrink-0">
          <Cpu className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <select
            id="select-model-dropdown"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 w-auto max-w-[130px] sm:max-w-[170px] truncate"
            title="Chọn model Gemini"
          >
            <option value="gemini-3.6-flash">Gemini 3.6 Flash (Mặc định)</option>
            <option value="pyrevit-code-pro">⚡ pyRevit Pro Coder (Free • Python)</option>
            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Cực nhanh)</option>
            <option value="gemini-3.1-flash-lite">Gemini Flash Lite (Bền bỉ)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Cân bằng)</option>
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (Suy luận sâu)</option>
          </select>
        </div>

        {/* PyRevit Pro Context Button */}
        <button
          id="btn-open-pyrevit-context"
          onClick={onOpenPyRevitContext}
          title="Cửa sổ Ngữ cảnh & Kho tri thức Google Drive cho pyRevit Pro Coder"
          className={`relative flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
            isPyRevitSelected
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs ring-1 ring-amber-300 animate-in fade-in"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <BookOpen className={`h-3.5 w-3.5 shrink-0 ${isPyRevitSelected ? "text-white" : "text-amber-600"}`} />
          <span className="hidden sm:inline whitespace-nowrap">Kho tri thức pyRevit</span>
          {pyRevitDocCount > 0 ? (
            <span className="rounded-full bg-amber-900/40 text-amber-100 px-1.5 py-0.2 text-[10px] font-bold">
              {pyRevitDocCount} file
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[9px] font-bold">
              +Drive
            </span>
          )}
        </button>

        {/* High Thinking Toggle */}
        <button
          id="btn-toggle-thinking"
          onClick={() => onToggleThinking(!enableThinking)}
          title={
            enableThinking
              ? "Chế độ High Thinking đang BẬT (Kích hoạt Gemini 3.8 Flash)"
              : "Bật chế độ High Thinking (Kích hoạt Gemini 3.8 Flash)"
          }
          className={`relative flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
            enableThinking
              ? "bg-amber-500 text-white shadow-xs ring-1 ring-amber-400"
              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Brain className={`h-3.5 w-3.5 shrink-0 ${enableThinking ? "animate-pulse" : "text-amber-600"}`} />
          <span className="hidden md:inline whitespace-nowrap">Thinking</span>
          <span className="text-[10px] opacity-90 whitespace-nowrap font-bold">
            {enableThinking ? "BẬT" : "TẮT"}
          </span>
        </button>

        {/* New chat */}
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          title="Tạo cuộc trò chuyện mới"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs whitespace-nowrap shrink-0 transition-colors hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="hidden lg:inline whitespace-nowrap">Đoạn chat mới</span>
        </button>

        {/* Clear chat (icon only) */}
        {hasMessages && (
          <button
            id="btn-header-clear-chat"
            onClick={onClearChat}
            title="Xóa lịch sử cuộc trò chuyện hiện tại"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Settings button */}
        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          title={hasApiKey ? "Cài đặt & Quản lý API Key (Đã kích hoạt)" : "Cài đặt & Nhập API Key"}
          className={`relative flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            hasApiKey
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Key className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden xl:inline whitespace-nowrap">{hasApiKey ? "Custom Key" : "Cài đặt"}</span>
          {hasApiKey && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Google User Profile / Login Button */}
        <button
          id="btn-google-auth-trigger"
          onClick={onOpenGoogleAuth}
          title={
            currentUser
              ? `Tài khoản lưu trữ: ${currentUser.email} (${currentUser.name})`
              : "Đăng nhập Google để lưu trữ lịch sử đoạn chat theo tài khoản"
          }
          className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
            currentUser
              ? "border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
              : "border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-400 active:scale-95"
          }`}
        >
          {currentUser ? (
            <>
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="h-4 w-4 rounded-full object-cover border border-emerald-300 shrink-0"
              />
              <span className="hidden sm:inline max-w-[80px] truncate">
                {currentUser.name}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden sm:inline whitespace-nowrap">Đăng nhập</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
