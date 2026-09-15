import React from "react";
import { Sparkles, Brain, Zap, ArrowRight } from "lucide-react";
import { PRESET_PROMPTS } from "../data/presets";
import { PresetPrompt } from "../types";

interface EmptyStateProps {
  onSelectPreset: (preset: PresetPrompt) => void;
  enableThinking: boolean;
  onToggleThinking: (val: boolean) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onSelectPreset,
  enableThinking,
  onToggleThinking,
}) => {
  return (
    <div
      id="empty-state-container"
      className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-8 text-center"
    >
      {/* Icon & Title */}
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-50">
        <Sparkles className="h-7 w-7" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Gemini 3.6 Flash AI Assistant
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
        Trải nghiệm mô hình Gemini 3.6 Flash tốc độ cao hoàn toàn miễn phí và chế độ{" "}
        <span className="font-semibold text-amber-600">
          High Thinking
        </span>{" "}
        chuyên sâu cho suy luận logic, toán học và lập trình phức tạp.
      </p>

      {/* Feature Highlights Bento */}
      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Gemini 3.6 Flash Card */}
        <div className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-blue-400 hover:shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Zap className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Gemini 3.6 Flash
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Phản hồi siêu tốc &amp; Đa phương thức
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Tối ưu cho hội thoại tự nhiên, tóm tắt nhanh, phân tích hình ảnh và hỗ trợ công việc hằng ngày tức thì.
          </p>
        </div>

        {/* High Thinking Card */}
        <div
          onClick={() => onToggleThinking(true)}
          className={`flex cursor-pointer flex-col items-start rounded-2xl border p-4 text-left shadow-xs transition-all ${
            enableThinking
              ? "border-amber-300 bg-amber-50 ring-2 ring-amber-300/60 shadow-sm"
              : "border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2 text-amber-600">
              <Brain className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">
                High Thinking Mode
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                enableThinking
                  ? "bg-amber-500 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {enableThinking ? "ĐANG BẬT" : "BẬT THỬ"}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Suy luận đa bước chuyên sâu
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Kích hoạt chế độ suy luận cấp cao ThinkingLevel.HIGH để bóc tách từng bước logic, chứng minh và giải mã code khó.
          </p>
        </div>
      </div>

      {/* Preset Prompts Section */}
      <div className="mt-8 w-full text-left">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Gợi ý câu hỏi thử nghiệm
          </span>
          <span className="text-xs text-slate-400">Nhấp vào để thử ngay</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {PRESET_PROMPTS.map((preset) => {
            const isThinking = preset.enableThinking;
            return (
              <button
                key={preset.id}
                id={`btn-preset-${preset.id}`}
                onClick={() => onSelectPreset(preset)}
                className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-400 hover:shadow-xs active:scale-[0.99]"
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      isThinking
                        ? "bg-amber-100 text-amber-900 border border-amber-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {isThinking ? <Brain className="h-3 w-3 text-amber-600" /> : <Zap className="h-3 w-3 text-blue-600" />}
                    {preset.category}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>

                <h4 className="mt-2 text-xs font-bold text-slate-800 group-hover:text-blue-600">
                  {preset.title}
                </h4>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
