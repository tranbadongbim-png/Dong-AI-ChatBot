import React, { useState } from "react";
import { X, Sparkles, Sliders, Check, RotateCcw } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInstruction: string;
  onSaveSystemInstruction: (instruction: string) => void;
}

const SYSTEM_PROMPT_PRESETS = [
  {
    title: "Chuyên gia suy luận & Lập trình",
    text: "Bạn là một kỹ sư phần mềm cao cấp và chuyên gia thuật toán. Luôn phân tích vấn đề theo từng bước logic, giải thích chi tiết các giả định, cân nhắc độ phức tạp thuật toán và đưa ra code mẫu tối ưu, sạch sẽ, có xử lý ngoại lệ.",
  },
  {
    title: "Trợ lý tổng quát chuẩn mực",
    text: "Bạn là Gemini 3.8 AI Assistant, một trợ lý thông minh, trung thực, chính xác và súc tích. Trả lời bằng tiếng Việt rõ ràng, trình bày có cấu trúc bằng markdown với tiêu đề và gạch đầu dòng khoa học.",
  },
  {
    title: "Giáo sư Toán & Khoa học",
    text: "Bạn là một nhà toán học và khoa học dữ liệu. Khi nhận câu hỏi, hãy trình bày lời giải tường minh, nêu rõ công thức, diễn giải logic từng bước và kiểm tra lại kết quả trước khi kết luận.",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  systemInstruction,
  onSaveSystemInstruction,
}) => {
  const [instruction, setInstruction] = useState(systemInstruction);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSystemInstruction(instruction);
    onClose();
  };

  const handleReset = () => {
    setInstruction("");
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="settings-modal-dialog"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Cài đặt Prompt Hệ Thống (System Instruction)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Định hình phong cách và vai trò của Gemini 3.8
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chỉ dẫn hệ thống cho mô hình
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Nhập vai trò hoặc quy tắc ứng xử (ví dụ: Bạn là chuyên gia giải toán...)"
              rows={4}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Mẫu vai trò có sẵn
            </span>
            <div className="space-y-1.5">
              {SYSTEM_PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setInstruction(preset.text)}
                  className="w-full rounded-lg border border-slate-200/80 p-2 text-left text-xs transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {preset.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {preset.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Mặc định</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
