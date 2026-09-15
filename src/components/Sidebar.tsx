import React from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Brain,
  Zap,
  X,
} from "lucide-react";
import { ChatSession } from "../types";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onClose: () => void;
  enableThinking: boolean;
  onToggleThinking: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onClose,
  enableThinking,
  onToggleThinking,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-white">
          <button
            id="btn-sidebar-new-chat"
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Cuộc trò chuyện mới</span>
          </button>

          <button
            id="btn-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
            className="ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* High Thinking Feature Banner */}
        <div className="p-3">
          <div
            id="high-thinking-info-card"
            className={`rounded-xl border p-3 transition-all ${
              enableThinking
                ? "border-amber-300 bg-amber-50 shadow-xs"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    enableThinking
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    High Thinking Mode
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    {enableThinking ? "ThinkingLevel.HIGH (Bật)" : "Tắt (Flash chuẩn)"}
                  </p>
                </div>
              </div>
              <button
                id="btn-sidebar-toggle-thinking"
                onClick={() => onToggleThinking(!enableThinking)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors ${
                  enableThinking
                    ? "bg-amber-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {enableThinking ? "BẬT" : "BẬT LÊN"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              {enableThinking
                ? "Đang sử dụng cấp độ suy luận cao (ThinkingLevel.HIGH) để phân tích chi tiết logic, thuật toán và bài toán khó."
                : "Chuyển đổi sang chế độ suy luận sâu để giải quyết các truy vấn học thuật, coding và logic phức tạp."}
            </p>
          </div>
        </div>

        {/* Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Lịch sử trò chuyện ({sessions.length})
          </div>

          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  id={`session-item-${session.id}`}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all ${
                    isActive
                      ? "bg-white font-semibold text-blue-600 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {session.enableThinking ? (
                      <Brain className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{session.title || "Đoạn chat chưa có tên"}</span>
                  </div>

                  <button
                    id={`btn-delete-session-${session.id}`}
                    onClick={(e) => onDeleteSession(session.id, e)}
                    aria-label="Xóa đoạn chat"
                    className="ml-2 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 p-3 bg-white">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 border border-slate-100">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Zap className="h-3 w-3 text-emerald-600" />
              Gemini 3.6 Flash
            </span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              v2.4.0 SDK
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
