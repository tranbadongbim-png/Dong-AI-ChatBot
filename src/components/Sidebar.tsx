import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Brain,
  Sparkles,
  X,
  Edit2,
  Check,
} from "lucide-react";
import { ChatSession } from "../types";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession: (id: string, newTitle: string) => void;
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
  onRenameSession,
  isOpen,
  onClose,
  enableThinking,
  onToggleThinking,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  };

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-white shrink-0">
          <button
            id="btn-sidebar-new-chat"
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Cuộc trò chuyện mới</span>
          </button>

          <button
            id="btn-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
            className="ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 shrink-0 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* High Thinking Feature Banner */}
        <div className="p-3 shrink-0">
          <div
            id="high-thinking-info-card"
            className={`rounded-xl border p-3 transition-all ${
              enableThinking
                ? "border-amber-300 bg-amber-50 shadow-xs"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    enableThinking
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Brain className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-bold text-slate-900 whitespace-nowrap">
                    High Thinking Mode
                  </h2>
                  <p className="text-[10px] text-slate-500 whitespace-nowrap">
                    {enableThinking ? "ThinkingLevel.HIGH (Bật)" : "Tắt (Flash chuẩn)"}
                  </p>
                </div>
              </div>
              <button
                id="btn-sidebar-toggle-thinking"
                onClick={() => onToggleThinking(!enableThinking)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap transition-colors ${
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
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            Lịch sử trò chuyện ({sessions.length})
          </div>

          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  id={`session-item-${session.id}`}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectSession(session.id);
                      if (window.innerWidth < 768) onClose();
                    }
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all ${
                    isActive
                      ? "bg-white font-semibold text-blue-600 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 mr-1">
                    {session.enableThinking ? (
                      <Brain className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}

                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(session.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="truncate" title={session.title}>
                        {session.title || "Đoạn chat chưa có tên"}
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          id={`btn-save-rename-${session.id}`}
                          onClick={(e) => handleSaveEdit(session.id, e)}
                          title="Lưu tên"
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-cancel-rename-${session.id}`}
                          onClick={handleCancelEdit}
                          title="Hủy"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          id={`btn-edit-session-${session.id}`}
                          onClick={(e) => handleStartEdit(session, e)}
                          aria-label="Đổi tên đoạn chat"
                          title="Đổi tên"
                          className="text-slate-400 opacity-0 transition-opacity hover:text-blue-600 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-100"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-session-${session.id}`}
                          onClick={(e) => onDeleteSession(session.id, e)}
                          aria-label="Xóa đoạn chat"
                          title="Xóa"
                          className="text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info: General Google Gemini AI Branding */}
        <div className="border-t border-slate-200 p-3 bg-white shrink-0">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 border border-slate-100">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 whitespace-nowrap">
              <Sparkles className="h-3 w-3 text-blue-600 shrink-0" />
              Google Gemini AI
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sẵn sàng
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
