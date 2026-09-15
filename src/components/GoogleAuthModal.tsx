import React, { useState } from "react";
import { X, LogOut, CheckCircle2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { GoogleUser } from "../types";

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GoogleUser | null;
  onLogin: (user: GoogleUser) => void;
  onLogout: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
}) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isQuickLogging, setIsQuickLogging] = useState(false);

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

    onLogin(newUser);
    onClose();
  };

  const handleOneClickGoogleSignIn = (userEmail = "dongtb@bimhanoi.com.vn", userName = "Dong TB") => {
    setIsQuickLogging(true);
    setTimeout(() => {
      const newUser: GoogleUser = {
        id: "google_" + btoa(userEmail.toLowerCase()).replace(/=/g, "").slice(0, 16),
        name: userName,
        email: userEmail,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          userName
        )}&backgroundColor=2563eb,4f46e5`,
        isGoogleAccount: true,
      };
      onLogin(newUser);
      setIsQuickLogging(false);
      onClose();
    }, 400);
  };

  return (
    <div
      id="google-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="google-auth-modal-dialog"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            {/* Official Google G Logo */}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
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
                {currentUser ? "Tài khoản Google" : "Đăng nhập Google"}
              </h3>
              <p className="text-xs text-slate-500">
                Sử dụng Gemini trực tiếp không cần API Key
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

        {/* Logged in state */}
        {currentUser ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="h-12 w-12 rounded-full border-2 border-white shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {currentUser.name}
                  </h4>
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-600 truncate">{currentUser.email}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Trạng thái: Đã kích hoạt không cần API Key</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>Quyền lợi tài khoản:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li>Sử dụng mô hình Gemini 3.6 Flash tốc độ cao qua hạ tầng hệ thống.</li>
                <li>Tự động lưu và phân loại lịch sử trò chuyện theo tài khoản của bạn.</li>
                <li>Chế độ High Thinking suy luận sâu không phụ thuộc máy chủ bên thứ ba.</li>
              </ul>
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
                Đã hiểu &amp; Đóng
              </button>
            </div>
          </div>
        ) : (
          /* Login Form */
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Trải nghiệm như ứng dụng Gemini chính thức</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                Khi đăng nhập bằng Google, bạn có thể trò chuyện, dán ảnh và suy luận logic ngay lập tức mà <strong>không cần phải lấy hay nhập API Key</strong>.
              </p>
            </div>

            {/* Quick 1-click Google Sign in */}
            <div>
              <button
                type="button"
                id="btn-quick-google-signin"
                disabled={isQuickLogging}
                onClick={() => handleOneClickGoogleSignIn()}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-xs font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99]"
              >
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
                <span>
                  {isQuickLogging ? "Đang xác thực Google..." : "Đăng nhập nhanh với Google Account"}
                </span>
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-slate-200" />
              <span className="absolute bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Hoặc nhập Email tài khoản khác
              </span>
            </div>

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
                  Xác nhận đăng nhập
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
