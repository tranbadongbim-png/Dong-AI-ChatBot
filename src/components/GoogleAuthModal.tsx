import React, { useState } from "react";
import {
  X,
  LogOut,
  Key,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { GoogleUser } from "../types";

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GoogleUser | null;
  onLogin: (user: GoogleUser) => void;
  onLogout: () => void;
  customApiKey?: string;
  onSaveCustomApiKey?: (key: string) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  customApiKey = "",
  onSaveCustomApiKey,
}) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey);
  const [isKeySaved, setIsKeySaved] = useState(false);

  if (!isOpen) return null;

  const handleCustomGoogleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const derivedName = name.trim() || email.split("@")[0] || "Người dùng Google";
    const newUser: GoogleUser = {
      id: "google_" + btoa(email.trim().toLowerCase()).replace(/=/g, "").slice(0, 16),
      name: derivedName,
      email: email.trim().toLowerCase(),
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        derivedName
      )}&backgroundColor=2563eb,4f46e5,7c3aed`,
      isGoogleAccount: true,
    };

    if (onSaveCustomApiKey && apiKeyInput.trim() !== customApiKey) {
      onSaveCustomApiKey(apiKeyInput.trim());
    }

    onLogin(newUser);
    onClose();
  };

  const handleSaveApiKeyOnly = () => {
    if (onSaveCustomApiKey) {
      onSaveCustomApiKey(apiKeyInput.trim());
      setIsKeySaved(true);
      setTimeout(() => setIsKeySaved(false), 2000);
    }
  };

  return (
    <div
      id="google-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="google-auth-modal-dialog"
        className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-xs shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {currentUser ? "Tài khoản lưu trữ" : "Đăng nhập Tài khoản"}
              </h3>
              <p className="text-xs text-slate-500">
                Quản lý và đồng bộ lịch sử chat theo người dùng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* IMPORTANT NOTICE BANNER: Clarify Login Purpose vs API Key */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Lưu ý quan trọng về Tài khoản &amp; API Key</span>
          </div>
          <p className="mt-1 leading-relaxed text-[11px] text-amber-900">
            • <strong>Đăng nhập tài khoản</strong>: Chỉ phục vụ <strong>phân loại và lưu trữ lịch sử đoạn chat</strong> cho riêng bạn.<br />
            • <strong>Gemini API Key</strong>: Để gửi câu hỏi và trò chuyện với mô hình AI, ứng dụng <strong>bắt buộc phải có API Key từ Google</strong>.
          </p>
        </div>

        {/* Logged-in State */}
        {currentUser ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="h-11 w-11 rounded-full border-2 border-white shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {currentUser.name}
                  </h4>
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-600 truncate">{currentUser.email}</p>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Đang lưu trữ lịch sử riêng cho tài khoản này</span>
                </div>
              </div>
            </div>

            {/* API Key quick setup inside account */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-blue-600" />
                  <span>Google Gemini API Key của bạn</span>
                </label>
                {customApiKey ? (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Đã cấu hình
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    Chưa nhập Key
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveApiKeyOnly}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {isKeySaved ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Đã lưu</span>
                    </>
                  ) : (
                    <span>Lưu Key</span>
                  )}
                </button>
              </div>
            </div>

            {/* Guide on getting key */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[11px] text-blue-900 space-y-2">
              <div className="font-bold text-blue-950 flex items-center justify-between">
                <span>Cách lấy Gemini API Key miễn phí (Google AI Studio):</span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                >
                  <span>Mở AI Studio</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 leading-relaxed pl-1">
                <li>Truy cập <strong>aistudio.google.com/apikey</strong> và đăng nhập bằng Google.</li>
                <li>Bấm nút <strong>"Create API key"</strong> (Tạo khóa API) ➔ Chọn hoặc tạo Project mới.</li>
                <li>Sao chép mã khóa (bắt đầu bằng <code>AIzaSy...</code>) và dán vào ô trên.</li>
              </ol>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất tài khoản</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                Hoàn tất &amp; Đóng
              </button>
            </div>
          </div>
        ) : (
          /* Login Form */
          <div className="mt-4 space-y-4">
            <form onSubmit={handleCustomGoogleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Địa chỉ Email Google
                </label>
                <input
                  type="email"
                  required
                  placeholder="vidu@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Tên của bạn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Guide section */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] text-blue-900 space-y-2">
                <div className="font-bold text-blue-950 flex items-center justify-between">
                  <span>Hướng dẫn lấy Gemini API Key (Miễn phí 100%):</span>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                  >
                    <span>Lấy Key ngay</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 leading-relaxed pl-1">
                  <li>Truy cập <code className="bg-white px-1 py-0.5 rounded border border-blue-200">aistudio.google.com/apikey</code></li>
                  <li>Bấm <strong>"Create API key"</strong> ➔ Sao chép mã khóa.</li>
                  <li>Dán mã vào phần <strong>Cài đặt (⚙️)</strong> để bắt đầu trò chuyện.</li>
                </ol>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Để sau
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  Xác nhận Đăng nhập
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
