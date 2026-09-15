import React from "react";
import { Brain, Sparkles, Plus, Trash2, Menu, Key } from "lucide-react";
import { GoogleUser } from "../types";

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
  onToggleSidebar,
  hasMessages,
  hasApiKey,
  currentUser,
  onOpenGoogleAuth,
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 sm:py-3 shadow-xs backdrop-blur-md shrink-0 gap-2 overflow-x-hidden"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          id="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">
                Gemini 3.6 Flash
              </h1>
              <span className="hidden sm:inline-flex shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Miễn phí &amp; Unlimited
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block whitespace-nowrap truncate">
              Google Gemini 3.6 Flash - Tốc độ cao &amp; Ổn định nhất
            </p>
          </div>
        </div>
      </div>

      {/* Right side action controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* High Thinking Toggle */}
        <button
          id="btn-toggle-thinking"
          onClick={() => onToggleThinking(!enableThinking)}
          title={
            enableThinking
              ? "Chế độ suy luận sâu đang bật"
              : "Bật chế độ High Thinking để xử lý câu hỏi phức tạp"
          }
          className={`relative flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
            enableThinking
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50"
              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
          }`}
        >
          <Brain className={`h-4 w-4 shrink-0 ${enableThinking ? "animate-pulse" : "text-amber-600"}`} />
          <span className="hidden md:inline whitespace-nowrap">High Thinking</span>
          <span className="text-[10px] opacity-90 whitespace-nowrap">
            {enableThinking ? "BẬT" : "TẮT"}
          </span>
        </button>

        {/* Action buttons: New chat */}
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          title="Tạo cuộc trò chuyện mới"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs whitespace-nowrap shrink-0 transition-colors hover:bg-slate-50 hover:border-slate-300"
        >
          <Plus className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Đoạn chat mới</span>
        </button>

        {hasMessages && (
          <button
            id="btn-header-clear-chat"
            onClick={onClearChat}
            title="Xóa lịch sử cuộc trò chuyện hiện tại"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        {/* Settings button */}
        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          title={hasApiKey ? "Cài đặt & Quản lý API Key (Đã kích hoạt)" : "Cài đặt & Nhập API Key"}
          className={`relative flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            hasApiKey
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Key className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline whitespace-nowrap">{hasApiKey ? "Custom Key" : "Cài đặt"}</span>
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
              ? `Đang đăng nhập: ${currentUser.email} (Không cần API Key)`
              : "Đăng nhập Google để dùng trực tiếp không cần API Key"
          }
          className={`flex h-8 items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
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
                className="h-5 w-5 rounded-full object-cover border border-emerald-300 shrink-0"
              />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {currentUser.name}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            </>
          ) : (
            <>
              {/* Google G logo */}
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
              <span className="hidden sm:inline whitespace-nowrap">Đăng nhập Google</span>
              <span className="sm:hidden whitespace-nowrap">Google</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
