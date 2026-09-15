import React, { useState, useRef, useEffect } from "react";
import {
  X,
  FolderGit2,
  RefreshCw,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  BookOpen,
  Code2,
  Lock,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Sparkles,
} from "lucide-react";
import { PyRevitContextConfig, PyRevitDocItem } from "../types";

interface PyRevitContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PyRevitContextConfig;
  onSaveConfig: (newConfig: PyRevitContextConfig) => void;
}

export const PyRevitContextModal: React.FC<PyRevitContextModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [driveUrl, setDriveUrl] = useState<string>(config.driveFolderUrl || "");
  const [documents, setDocuments] = useState<PyRevitDocItem[]>(config.documents || []);
  const [customGuidelines, setCustomGuidelines] = useState<string>(config.customGuidelines || "");
  const [enforceFullReading, setEnforceFullReading] = useState<boolean>(
    typeof config.enforceFullReading === "boolean" ? config.enforceFullReading : true
  );
  const [autoSync, setAutoSync] = useState<boolean>(config.autoSync || false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>({ type: null, message: "" });

  const [previewDoc, setPreviewDoc] = useState<PyRevitDocItem | null>(null);
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);
  const [manualName, setManualName] = useState<string>("");
  const [manualContent, setManualContent] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens or config updates from parent
  useEffect(() => {
    if (isOpen) {
      setDriveUrl(config.driveFolderUrl || "");
      setDocuments(config.documents || []);
      setCustomGuidelines(config.customGuidelines || "");
      setEnforceFullReading(typeof config.enforceFullReading === "boolean" ? config.enforceFullReading : true);
      setAutoSync(config.autoSync || false);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  // Instant persistence helper to guarantee files are saved even if modal is closed via X
  const persistChanges = (
    updatedDocs: PyRevitDocItem[] = documents,
    updatedUrl: string = driveUrl,
    updatedGuidelines: string = customGuidelines,
    updatedEnforce: boolean = enforceFullReading
  ) => {
    const updatedConfig: PyRevitContextConfig = {
      driveFolderUrl: updatedUrl.trim(),
      autoSync,
      enforceFullReading: updatedEnforce,
      customGuidelines: updatedGuidelines.trim(),
      documents: updatedDocs,
      lastSyncedAt: Date.now(),
    };
    onSaveConfig(updatedConfig);
  };

  // Handle Drive Sync
  const handleSyncDrive = async () => {
    if (!driveUrl.trim()) {
      setSyncStatus({
        type: "error",
        message: "Vui lòng nhập đường dẫn thư mục Google Drive công khai.",
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({
      type: "info",
      message: "Đang quét và tải dữ liệu từ Google Drive...",
    });

    try {
      const resp = await fetch("/api/pyrevit/sync-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFolderUrl: driveUrl.trim() }),
      });

      const data = await resp.json();

      if (data.success && Array.isArray(data.documents)) {
        // Merge with existing docs (keep manually added, update drive ones)
        const nonDriveDocs = documents.filter((d) => d.source !== "google_drive");
        const newDocs = [...nonDriveDocs, ...data.documents];
        setDocuments(newDocs);
        persistChanges(newDocs, driveUrl);

        setSyncStatus({
          type: "success",
          message: data.message || `Đã nạp ${data.documents.length} tài liệu từ Google Drive!`,
        });
      } else {
        setSyncStatus({
          type: "error",
          message: data.message || "Không thể tải thư mục Google Drive. Bạn có thể tải file trực tiếp từ máy tính bằng nút bên dưới.",
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: "Lỗi kết nối máy chủ: " + (err.message || "Vui lòng thử lại."),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: PyRevitDocItem[] = [];
    const readPromises: Promise<void>[] = [];

    Array.from(files).forEach((file) => {
      const promise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
            newDocs.push({
              id: "local_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
              name: file.name,
              content,
              size: file.size,
              type: ext,
              source: "file_upload",
              updatedAt: Date.now(),
              enabled: true,
            });
          }
          resolve();
        };
        reader.readAsText(file);
      });
      readPromises.push(promise);
    });

    Promise.all(readPromises).then(() => {
      const merged = [...documents, ...newDocs];
      setDocuments(merged);
      persistChanges(merged);
      setSyncStatus({
        type: "success",
        message: `Đã nạp và lưu thành công ${newDocs.length} tệp từ máy tính vào Kho tri thức!`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  // Add manual snippet
  const handleAddManual = () => {
    if (!manualName.trim() || !manualContent.trim()) return;

    const ext = manualName.split(".").pop()?.toLowerCase() || "txt";
    const newDoc: PyRevitDocItem = {
      id: "manual_" + Date.now().toString(36),
      name: manualName.trim(),
      content: manualContent.trim(),
      size: manualContent.length,
      type: ext,
      source: "manual",
      updatedAt: Date.now(),
      enabled: true,
    };

    const merged = [...documents, newDoc];
    setDocuments(merged);
    persistChanges(merged);
    setManualName("");
    setManualContent("");
    setIsAddingManual(false);
  };

  // Toggle document enable/disable
  const handleToggleDoc = (docId: string) => {
    const updated = documents.map((d) => (d.id === docId ? { ...d, enabled: !d.enabled } : d));
    setDocuments(updated);
    persistChanges(updated);
  };

  // Delete document
  const handleDeleteDoc = (docId: string) => {
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    persistChanges(updated);
  };

  // Save changes explicitly
  const handleSave = () => {
    persistChanges(documents, driveUrl, customGuidelines, enforceFullReading);
    onClose();
  };

  const activeDocCount = documents.filter((d) => d.enabled).length;
  const totalChars = documents
    .filter((d) => d.enabled)
    .reduce((acc, d) => acc + (d.content?.length || 0), 0);

  return (
    <div
      id="pyrevit-context-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="pyrevit-context-modal-card"
        className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-400/40 text-amber-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">
                  Cửa sổ Ngữ cảnh & Kho tri thức pyRevit Pro Coder
                </h3>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                  ⚡ PRO ONLY
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Cung cấp mã nguồn, helper modules & tài liệu Revit API từ Google Drive để pyRevit Coder đọc trước khi lập trình.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Section 1: Google Drive Sync */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <FolderGit2 className="h-4 w-4 text-blue-600" />
                <span>Nạp tài liệu tự động từ Google Drive công khai</span>
              </div>
              <span className="text-[11px] text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">
                Hỗ trợ Thư mục &amp; Google Docs
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Dán đường dẫn Thư mục Google Drive (chế độ <i>"Bất kỳ ai có đường liên kết đều xem được"</i>) chứa các file script `.py`, tài liệu `.txt`, `.md` hoặc bài giảng Revit API.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1wN0q4kL45..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <button
                onClick={handleSyncDrive}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Đang quét..." : "Đồng bộ từ Drive"}</span>
              </button>
            </div>

            {/* Sync Status Banner */}
            {syncStatus.message && (
              <div
                className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
                  syncStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : syncStatus.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {syncStatus.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : syncStatus.type === "error" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                ) : (
                  <RefreshCw className="h-4 w-4 shrink-0 text-blue-600 animate-spin mt-0.5" />
                )}
                <span className="flex-1 font-medium">{syncStatus.message}</span>
              </div>
            )}
          </div>

          {/* Section 2: Documents & Manual snippet */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Danh sách Tài liệu &amp; Mã nguồn trong Kho tri thức ({documents.length} tệp)
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingManual(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span>Thêm đoạn mã / quy chuẩn thủ công</span>
              </button>
            </div>
          </div>

          {/* Manual document input form */}
          {isAddingManual && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-in fade-in duration-150">
              <h5 className="text-xs font-bold text-amber-900">
                Thêm đoạn code / quy tắc pyRevit mới
              </h5>
              <input
                type="text"
                placeholder="Tên file (ví dụ: helper_revit.py hoặc quy_tac_cong_ty.txt)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-mono"
              />
              <textarea
                rows={4}
                placeholder="Nội dung mã nguồn Python hoặc tài liệu pyRevit..."
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs focus:outline-none focus:border-amber-500 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsAddingManual(false)}
                  className="rounded-lg px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddManual}
                  disabled={!manualName.trim() || !manualContent.trim()}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Lưu tệp
                </button>
              </div>
            </div>
          )}

          {/* Documents Table / List */}
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
              <FileCode className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Chưa có tài liệu nào trong kho tri thức</p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                Dán đường dẫn Google Drive ở trên hoặc bấm nút "Tải tệp từ máy tính" để nạp các script `.py` dự án cho pyRevit Pro Coder học.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Đang bật: {activeDocCount}/{documents.length} tệp</span>
                <span>Tổng dung lượng chữ: ~{(totalChars / 1000).toFixed(1)}k ký tự</span>
              </div>

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-56 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 transition-colors ${
                      doc.enabled ? "bg-white" : "bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={doc.enabled}
                        onChange={() => handleToggleDoc(doc.id)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 truncate">
                            {doc.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              doc.type === "py"
                                ? "bg-emerald-100 text-emerald-800"
                                : doc.type === "txt" || doc.type === "md"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            .{doc.type}
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-200">
                            🐍 pyRevit Extension
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({(doc.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        {doc.sourceUrl && (
                          <a
                            href={doc.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-0.5"
                          >
                            <span>Xem trên Google Drive</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        title="Xem trước nội dung file"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        title="Xóa tệp khỏi kho tri thức"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Custom Prompt Guidelines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Quy chuẩn &amp; Hướng dẫn riêng cho pyRevit Coder (Custom System Rules)</span>
              </label>
              <span className="text-[10px] text-slate-400">Được tự động đính kèm vào System Prompt</span>
            </div>
            <textarea
              rows={3}
              value={customGuidelines}
              onChange={(e) => setCustomGuidelines(e.target.value)}
              placeholder="Ví dụ: Luôn viết code Python chạy trên Revit 2024; Mọi giao diện đều sử dụng pyrevit.forms; Ưu tiên dùng FilteredElementCollector và tạo sẵn nút bấm nút thanh Ribbon..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Section 4: Configuration Toggles */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Bắt buộc pyRevit Coder đọc toàn bộ kho tri thức trước khi trả lời
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Nạp đầy đủ toàn bộ code mẫu &amp; tài liệu ở trên vào context của AI trong mỗi lượt chat.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enforceFullReading}
                onChange={(e) => setEnforceFullReading(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Tài liệu được lưu an toàn trong trình duyệt cá nhân của bạn.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Áp dụng Kho tri thức ({activeDocCount} tệp)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document Content Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
              <span className="font-mono text-xs font-bold">{previewDoc.name}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
              <pre className="whitespace-pre-wrap">{previewDoc.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
