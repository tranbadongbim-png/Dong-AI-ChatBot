import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initializer for Google GenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY chưa được thiết lập trong biến môi trường.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: "ok",
    hasApiKey: hasKey,
    defaultModel: "gemini-3.8-flash",
  });
});

interface AttachmentPayload {
  data?: string;
  mimeType?: string;
  name?: string;
  fileType?: "image" | "pdf" | "code" | "text";
  textContent?: string;
}

interface ChatHistoryItem {
  role: "user" | "model";
  text: string;
  images?: AttachmentPayload[];
}

// Generate real-time context containing today's exact date, time, year, and weekday
function getRealtimeSystemInstruction(userCustomInstruction?: string): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const isoTime = now.toISOString();

  const timeContext = `[THÔNG TIN THỜI GIAN THỰC HỆ THỐNG]:
- Hôm nay là: ${formattedDate}
- Thời gian hiện tại: ${formattedTime} (ISO: ${isoTime})
- Năm hiện tại: ${now.getFullYear()}
Bạn là trợ lý AI thông minh sử dụng mô hình Gemini mới nhất của Google. Bạn luôn nắm bắt chính xác ngày giờ hiện tại, thông tin và sự kiện mới nhất. Khi người dùng hỏi về thời gian, ngày tháng, tin tức, thời tiết hoặc dữ liệu hiện tại, hãy sử dụng mốc thời gian này và tìm kiếm thông tin mới nhất trên Google để trả lời chính xác.`;

  if (userCustomInstruction && userCustomInstruction.trim()) {
    return `${timeContext}\n\n[HƯỚNG DẪN TÙY BIẾN CỦA NGƯỜI DÙNG]:\n${userCustomInstruction.trim()}`;
  }
  return timeContext;
}

// Helper to format an individual attachment (image, pdf, or code/text) into a Gemini Part
function formatAttachmentPart(att: AttachmentPayload) {
  // If it's a code or text file, inject directly as structured text for optimal reasoning
  if (
    att.fileType === "code" ||
    att.fileType === "text" ||
    att.textContent ||
    att.name?.match(/\.(xaml|py|js|ts|tsx|jsx|cpp|c|h|hpp|cs|java|go|rs|php|rb|swift|kt|sql|sh|bash|json|csv|xml|yaml|yml|html|css|scss|md|txt|env|toml|ini|dockerfile)$/i)
  ) {
    let codeText = att.textContent;
    if (!codeText && att.data) {
      if (att.data.includes(",")) {
        try {
          const b64 = att.data.split(",")[1];
          codeText = Buffer.from(b64, "base64").toString("utf-8");
        } catch {
          codeText = att.data;
        }
      } else {
        codeText = att.data;
      }
    }
    const fileName = att.name || "code_file";
    return {
      text: `--- [TỆP ĐÍNH KÈM: ${fileName}] ---\n${codeText || ""}\n--- [HẾT TỆP: ${fileName}] ---`,
    };
  }

  // Handle PDF
  if (att.mimeType === "application/pdf" || att.name?.toLowerCase().endsWith(".pdf")) {
    let b64 = att.data || "";
    if (b64.includes(",")) {
      b64 = b64.split(",")[1];
    }
    return {
      inlineData: {
        data: b64,
        mimeType: "application/pdf",
      },
    };
  }

  // Fallback for Images
  let base64Data = att.data || "";
  let mimeType = att.mimeType || "image/jpeg";

  if (base64Data.startsWith("data:")) {
    const parts = base64Data.split(",");
    const match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
    base64Data = parts[1] || "";
  }

  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

// Convert history and current prompt/images into Gemini API contents structure
function formatContents(
  prompt: string,
  history: ChatHistoryItem[] = [],
  images: AttachmentPayload[] = []
) {
  const contents: any[] = [];

  // Add historical turns
  for (const item of history) {
    const parts: any[] = [];

    if (item.images && item.images.length > 0) {
      for (const img of item.images) {
        parts.push(formatAttachmentPart(img));
      }
    }

    if (item.text && item.text.trim()) {
      parts.push({ text: item.text.trim() });
    }

    if (parts.length > 0) {
      contents.push({
        role: item.role === "user" ? "user" : "model",
        parts,
      });
    }
  }

  // Add current prompt and images as final user turn
  const currentParts: any[] = [];
  if (images && images.length > 0) {
    for (const img of images) {
      currentParts.push(formatAttachmentPart(img));
    }
  }
  if (prompt && prompt.trim()) {
    currentParts.push({ text: prompt.trim() });
  } else if (images && images.length > 0) {
    currentParts.push({ text: "Hãy đọc, phân tích chi tiết và giải thích nội dung tệp đính kèm này." });
  }

  if (currentParts.length > 0) {
    contents.push({
      role: "user",
      parts: currentParts,
    });
  }

  return contents;
}

// Helper to extract clean error message
function extractErrorMessage(error: any): string {
  if (!error) return "Đã xảy ra lỗi không xác định.";
  let rawMsg = typeof error === "string" ? error : error.message || String(error);

  if (typeof error === "object" && error?.message) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error?.message) {
        rawMsg = parsed.error.message;
      }
    } catch {
      // Not JSON
    }
  }

  // Handle 429 Quota Exceeded cleanly
  if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("Quota exceeded")) {
    const retryMatch = rawMsg.match(/retry in ([0-9ms\.\s]+)/i) || rawMsg.match(/retryDelay"?:\s*"([0-9a-z]+)"/i);
    const retryInfo = retryMatch ? ` Vui lòng thử lại sau khoảng ${retryMatch[1]}.` : "";
    return `Đã vượt quá giới hạn lượt gọi (Quota Exceeded / Rate Limit) của API Key hiện tại.${retryInfo}\n\nMẹo: Bạn có thể tạo thêm API Key miễn phí mới tại aistudio.google.com và dán vào phần Cài đặt (⚙️) trên thanh công cụ để tiếp tục dùng ngay lập tức.`;
  }

  // Handle 503 High Demand cleanly
  if (rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand") || rawMsg.includes("overloaded")) {
    return "Mô hình hiện đang quá tải từ máy chủ Google (503 Service Unavailable / High demand). Vui lòng thử lại sau giây lát.";
  }

  return rawMsg;
}

// Format explicit, helpful error when High Thinking mode fails on both 3.8 and 3.6
function formatThinkingFailureError(error: any): string {
  const detail = extractErrorMessage(error);
  return (
    `⚠️ Lỗi xử lý ở Chế độ High Thinking (Suy luận sâu):\n\n` +
    `• Đã kích hoạt mô hình chính Gemini 3.8 Flash nhưng không thể hoàn thành.\n` +
    `• Đã thử gọi tiếp mô hình dự phòng Gemini 3.6 Flash nhưng cũng không phản hồi.\n\n` +
    `Chi tiết lỗi từ Google API: ${detail}\n\n` +
    `Theo thiết lập chất lượng cao, hệ thống KHÔNG hạ cấp sang các dòng Flash Lite để bảo toàn độ chính xác và khả năng tư duy logic.\n\n` +
    `💡 Hướng giải quyết:\n` +
    `1. Vui lòng thử lại sau giây lát khi máy chủ Google giảm bớt tải.\n` +
    `2. Hoặc nhập Gemini API Key cá nhân trong phần Cài đặt (⚙️) ở góc trên bên phải để sử dụng quota riêng không bị hạn chế.\n` +
    `3. Hoặc tắt Chế độ High Thinking để trò chuyện bình thường với tốc độ phản hồi tức thì.`
  );
}

// Live web search crawler for resilient fallback when native Google Search Grounding hits 429/503
async function fetchLiveWebSearch(query: string): Promise<{ title: string; uri: string; snippet: string }[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const resp = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!resp.ok) return [];
    const html = await resp.text();
    const results: { title: string; uri: string; snippet: string }[] = [];

    // Parse result blocks
    const resultBlocks = html.split(/class="result\s+results_links/gi).slice(1);
    for (const block of resultBlocks.slice(0, 6)) {
      const urlMatch = block.match(/href="([^"]+)"/i);
      const titleMatch = block.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

      let rawUrl = urlMatch ? urlMatch[1] : "";
      if (rawUrl.includes("uddg=")) {
        try {
          const decoded = decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0]);
          rawUrl = decoded;
        } catch {
          // ignore
        }
      }

      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";

      if (title && rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("duckduckgo.com")) {
        results.push({
          title,
          uri: rawUrl,
          snippet,
        });
      }
    }
    return results;
  } catch (e) {
    console.error("Live Web Search fetch error:", e);
    return [];
  }
}

// Specialized instructions for pyRevit & Revit API development
const PYREVIT_SPECIALIST_INSTRUCTION = `
Bạn là Chuyên gia Lập trình pyRevit & Autodesk Revit API hàng đầu (pyRevit Senior Developer & BIM Automation Specialist).
Mô hình chuyên dụng này được tối ưu cho việc code Python trên nền tảng pyRevit, tốc độ phản hồi cực nhanh, miễn phí và không bị giới hạn hạn ngạch khắt khe.

Các nguyên tắc bắt buộc khi viết mã pyRevit:
1. Cấu trúc mã pyRevit chuẩn:
# -*- coding: utf-8 -*-
__title__ = "Tên Công Cụ"
__author__ = "BIM Developer"
__doc__ = """Mô tả chức năng công cụ chi tiết."""

from pyrevit import revit, DB, UI, script, forms
doc = revit.doc
uidoc = revit.uidoc
app = revit.app

2. Thư viện Autodesk Revit API & IronPython/CPython:
- Import đầy đủ namespace cần thiết từ Autodesk.Revit.DB (FilteredElementCollector, BuiltInCategory, BuiltInParameter, Transaction, ElementId, XYZ, UnitUtils, v.v.).
- Quản lý Transaction an toàn khi thay đổi Document:
  with revit.Transaction("Tên tác vụ"):
      # Các thay đổi Revit DB
  hoặc sử dụng khối try...finally với t = DB.Transaction(doc, "Tên tác vụ") -> t.Start() -> t.Commit() -> t.RollBack().

3. Thu thập đối tượng (FilteredElementCollector):
- Luôn kết hợp WhereElementIsNotElementType() hoặc WhereElementIsElementType() để tối ưu bộ nhớ.
- Lọc theo Category hoặc Class chuẩn xác:
  FilteredElementCollector(doc).OfCategory(DB.BuiltInCategory.OST_Walls).WhereElementIsNotElementType().ToElements()

4. Tương tác với người dùng qua pyRevit forms:
- Sử dụng forms.alert(), forms.SelectFromList, forms.ask_for_string() khi cần giao diện nhập liệu.
- In kết quả, thông báo lỗi rõ ràng qua script.get_output().

5. Xử lý đơn vị (UnitUtils):
- Chuyển đổi giữa Feet (đơn vị nội bộ Revit) và Mét/Milimét sử dụng DB.UnitUtils (tương thích cả ForgeTypeId / UnitTypeId trên Revit 2022+ và DisplayUnitType trên Revit cũ).

6. Phong cách phản hồi:
- Cung cấp code Python hoàn chỉnh, có chú thích tiếng Việt rõ ràng, kèm hướng dẫn đặt vị trí file trong cấu trúc extension (.extension/.tab/.panel/.pushbutton/script.py).
`;

// Helper to format knowledge base documents for pyRevit Coder & Gemini
function buildPyRevitKnowledgeContext(pyRevitContext: any): string {
  if (!pyRevitContext) return "";
  const activeDocs = (pyRevitContext.documents || []).filter(
    (d: any) => d && d.enabled !== false && d.content && typeof d.content === "string"
  );
  const customRules = pyRevitContext.customGuidelines?.trim() || "";

  if (activeDocs.length === 0 && !customRules) {
    return `\n\n[TRẠNG THÁI KHO TRI THỨC]: Hiện tại người dùng chưa nạp tệp nào vào kho tri thức (hoặc tất cả tệp đang ở trạng thái tắt). Nếu người dùng hỏi về file trong kho kiến thức, hãy nhắc người dùng mở cửa sổ "Kho tri thức pyRevit" (+Drive) trên thanh công cụ để nạp tệp .py/.txt từ máy tính hoặc dán link Google Drive.\n`;
  }

  const fileListNames = activeDocs.map((d: any) => d.name || "Tài liệu").join(", ");

  let contextBlock = `\n\n================================================================================
[KHO TRI THỨC, TÀI LIỆU & MÃ NGUỒN DỰ ÁN DÀNH CHO AI - BẮT BUỘC ĐỌC VÀ TUÂN THỦ]
XÁC NHẬN HỆ THỐNG: Toàn bộ ${activeDocs.length} tệp tài liệu và mã nguồn dưới đây ĐÃ ĐƯỢC TỰ ĐỘNG NẠP TRỰC TIẾP VÀO CONTEXT BỘ NHỚ CỦA BẠN.

QUY TẮC BẮT BUỘC KHI PHẢN HỒI:
1. Khi người dùng hỏi: "Mày có đọc được file trong kho kiến thức không?", "Bạn có đọc được file kho tri thức không?" hoặc tương tự:
   -> BẠN PHẢI TRẢ LỜI NGAY: "Có, tôi đã đọc và nắm vững tất cả ${activeDocs.length} tệp trong Kho tri thức của bạn!"
   -> Liệt kê rõ danh sách tên các tệp bạn đang giữ trong context: ${fileListNames}.
   -> Tóm tắt ngắn gọn nội dung/chức năng chính của từng tệp nếu người dùng yêu cầu.
2. TUYỆT ĐỐI KHÔNG ĐƯỢC trả lời "tôi không trực tiếp truy cập vào ổ cứng cục bộ" hay yêu cầu người dùng dán lại code vào khung chat. Bởi vì toàn bộ nội dung file đã được nạp sẵn ở ngay bên dưới.
3. Khi lập trình pyRevit hay viết tool, bạn PHẢI áp dụng và tái sử dụng các hàm helper, quy chuẩn, cấu trúc class trong các tệp kho tri thức này.
`;

  if (customRules) {
    contextBlock += `\n[QUY CHUẨN & HƯỚNG DẪN RIÊNG CỦA NGƯỜI DÙNG]:\n${customRules}\n`;
  }

  if (activeDocs.length > 0) {
    contextBlock += `\n[NỘI DUNG CHI TIẾT CÁC TỆP TRONG KHO TRI THỨC (${activeDocs.length} TỆP)]:\n`;
    activeDocs.forEach((doc: any, index: number) => {
      const docName = doc.name || `Tài liệu ${index + 1}`;
      const docType = doc.type || "file";
      const truncatedContent = doc.content.length > 100000 ? doc.content.slice(0, 100000) + "\n...[Đã rút gọn vì nội dung lớn]..." : doc.content;
      contextBlock += `\n--- [TỆP ${index + 1}/${activeDocs.length}: ${docName} (Định dạng: .${docType})] ---\n${truncatedContent}\n--- [HẾT TỆP ${index + 1}: ${docName}] ---\n`;
    });
  }

  contextBlock += `================================================================================\n`;
  return contextBlock;
}

// Google Drive & Public URL Document Scraper / Fetcher
async function syncGoogleDrivePublicUrl(targetUrl: string): Promise<{
  success: boolean;
  folderTitle?: string;
  documents: Array<{
    id: string;
    name: string;
    content: string;
    size: number;
    type: string;
    source: "google_drive" | "file_upload" | "manual";
    sourceUrl?: string;
    updatedAt: number;
    enabled: boolean;
  }>;
  message: string;
}> {
  if (!targetUrl || typeof targetUrl !== "string") {
    return { success: false, documents: [], message: "Vui lòng nhập đường link Google Drive hoặc tài liệu hợp lệ." };
  }

  const cleanUrl = targetUrl.trim();

  // 1. Google Doc single URL
  const docMatch = cleanUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/i);
  if (docMatch) {
    const docId = docMatch[1];
    try {
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const resp = await fetch(exportUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!resp.ok) {
        throw new Error(`Google Doc yêu cầu quyền truy cập (Mã HTTP: ${resp.status}). Vui lòng mở quyền "Bất kỳ ai có liên kết đều xem được".`);
      }
      const text = await resp.text();
      if (!text || text.includes("<html") && text.includes("ServiceLogin")) {
        throw new Error("Tài liệu Google Doc đang ở chế độ Riêng tư (Private). Vui lòng chuyển sang chế độ 'Bất kỳ ai có đường liên kết đều có thể xem'.");
      }
      return {
        success: true,
        folderTitle: "Google Doc Document",
        documents: [
          {
            id: "doc_" + docId,
            name: "Google_Doc_pyRevit_Guide.txt",
            content: text,
            size: text.length,
            type: "txt",
            source: "google_drive",
            sourceUrl: cleanUrl,
            updatedAt: Date.now(),
            enabled: true,
          },
        ],
        message: "Đồng bộ thành công 1 tài liệu Google Doc.",
      };
    } catch (err: any) {
      return { success: false, documents: [], message: err.message || "Không thể tải Google Doc." };
    }
  }

  // 2. Google Drive File download URL
  const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch) {
    const fileId = fileMatch[1];
    try {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const resp = await fetch(downloadUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!resp.ok) {
        throw new Error(`File Google Drive yêu cầu quyền truy cập (Mã HTTP: ${resp.status}).`);
      }
      const text = await resp.text();
      return {
        success: true,
        folderTitle: "Google Drive File",
        documents: [
          {
            id: "file_" + fileId,
            name: "drive_file_" + fileId.slice(0, 8) + ".py",
            content: text,
            size: text.length,
            type: "py",
            source: "google_drive",
            sourceUrl: cleanUrl,
            updatedAt: Date.now(),
            enabled: true,
          },
        ],
        message: "Đồng bộ thành công tệp từ Google Drive.",
      };
    } catch (err: any) {
      return { success: false, documents: [], message: err.message || "Không thể tải tệp Google Drive." };
    }
  }

  // 3. Google Drive Folder URL or Folder ID
  let folderId = "";
  const folderMatch = cleanUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/i) || cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (folderMatch) {
    folderId = folderMatch[1];
  } else if (/^[a-zA-Z0-9_-]{25,}$/.test(cleanUrl)) {
    folderId = cleanUrl;
  }

  if (folderId) {
    try {
      // Fetch public embedded folderview or standard folder page
      const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
      const resp = await fetch(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!resp.ok) {
        throw new Error(`Thư mục Google Drive phản hồi lỗi HTTP ${resp.status}. Hãy đảm bảo thư mục được chia sẻ ở chế độ "Bất kỳ ai có liên kết".`);
      }

      const html = await resp.text();

      if (html.includes("ServiceLogin") && !html.includes("flip-entry")) {
        return {
          success: false,
          documents: [],
          message: "Thư mục Google Drive này đang ở chế độ Riêng tư (Private). Vui lòng vào Google Drive -> Chuột phải vào Thư mục -> Chia sẻ -> Chuyển thành 'Bất kỳ ai có đường liên kết' -> Người xem.",
        };
      }

      const foundFiles: Array<{ id: string; name: string }> = [];

      // Regex 1: Match flip-entry HTML items
      const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[^>]*>[\s\S]*?<div class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      while ((match = entryRegex.exec(html)) !== null) {
        const id = match[1];
        const name = match[2].replace(/<[^>]+>/g, "").trim();
        if (id && name && !foundFiles.some((f) => f.id === id)) {
          foundFiles.push({ id, name });
        }
      }

      // Regex 2: Match JavaScript array entries in script tags [id, title]
      if (foundFiles.length === 0) {
        const jsEntryRegex = /\["([a-zA-Z0-9_-]{25,})",\["([^"]+\.(?:py|txt|md|json|xaml|csv|xml|cs|doc|docx|rst|yaml|yml))"/gi;
        let jsMatch;
        while ((jsMatch = jsEntryRegex.exec(html)) !== null) {
          const id = jsMatch[1];
          const name = jsMatch[2];
          if (id && name && !foundFiles.some((f) => f.id === id)) {
            foundFiles.push({ id, name });
          }
        }
      }

      // Regex 3: Match raw download or file links in HTML
      if (foundFiles.length === 0) {
        const linkRegex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/gi;
        let lMatch;
        while ((lMatch = linkRegex.exec(html)) !== null) {
          const id = lMatch[1];
          if (id && id !== folderId && !foundFiles.some((f) => f.id === id)) {
            foundFiles.push({ id, name: `file_${id.slice(0, 6)}.py` });
          }
        }
      }

      if (foundFiles.length === 0) {
        return {
          success: false,
          documents: [],
          message: `Đã kết nối được tới thư mục Drive (${folderId}), nhưng chưa quét thấy tệp mã nguồn (.py, .md, .txt, .json). Bạn có thể tải trực tiếp file lên hoặc kiểm tra lại quyền chia sẻ công khai của các tệp bên trong thư mục.`,
        };
      }

      // Fetch file contents in parallel (max 15 files)
      const downloadedDocs: Array<{
        id: string;
        name: string;
        content: string;
        size: number;
        type: string;
        source: "google_drive" | "file_upload" | "manual";
        sourceUrl?: string;
        updatedAt: number;
        enabled: boolean;
      }> = [];

      const targetFiles = foundFiles.slice(0, 15);
      for (const item of targetFiles) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          
          let fileDownloadUrl = `https://drive.google.com/uc?export=download&id=${item.id}`;
          // If name suggests Google Doc, try export txt
          if (item.name.endsWith(".doc") || item.name.endsWith(".docx") || !item.name.includes(".")) {
            fileDownloadUrl = `https://docs.google.com/document/d/${item.id}/export?format=txt`;
          }

          const fileResp = await fetch(fileDownloadUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (fileResp.ok) {
            const textContent = await fileResp.text();
            if (textContent && !textContent.includes("<!DOCTYPE html>") && !textContent.includes("ServiceLogin")) {
              const ext = item.name.split(".").pop()?.toLowerCase() || "py";
              downloadedDocs.push({
                id: `gdrive_${item.id}`,
                name: item.name,
                content: textContent,
                size: textContent.length,
                type: ext,
                source: "google_drive",
                sourceUrl: `https://drive.google.com/file/d/${item.id}/view`,
                updatedAt: Date.now(),
                enabled: true,
              });
            }
          }
        } catch (fErr) {
          console.warn(`Failed to fetch file ${item.name} (${item.id}):`, fErr);
        }
      }

      if (downloadedDocs.length === 0) {
        return {
          success: false,
          documents: [],
          message: `Tìm thấy ${foundFiles.length} tệp trong thư mục nhưng các tệp con chưa được mở quyền đọc công khai ("Bất kỳ ai có đường liên kết"). Vui lòng kiểm tra quyền chia sẻ của các tệp trong thư mục.`,
        };
      }

      return {
        success: true,
        folderTitle: `Thư mục Google Drive (${folderId})`,
        documents: downloadedDocs,
        message: `Đồng bộ thành công ${downloadedDocs.length} tệp tài liệu & mã nguồn pyRevit từ Google Drive!`,
      };
    } catch (err: any) {
      return { success: false, documents: [], message: err.message || "Lỗi khi quét thư mục Google Drive." };
    }
  }

  // 4. Fallback for raw URLs (e.g. GitHub raw URL, web raw text/py script)
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    try {
      const resp = await fetch(cleanUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (resp.ok) {
        const text = await resp.text();
        const urlParts = cleanUrl.split("/");
        const fileName = urlParts[urlParts.length - 1].split("?")[0] || "external_script.py";
        const ext = fileName.split(".").pop()?.toLowerCase() || "py";
        return {
          success: true,
          folderTitle: "Tài liệu trực tuyến",
          documents: [
            {
              id: "url_" + Date.now().toString(36),
              name: fileName,
              content: text,
              size: text.length,
              type: ext,
              source: "google_drive",
              sourceUrl: cleanUrl,
              updatedAt: Date.now(),
              enabled: true,
            },
          ],
          message: `Đồng bộ thành công tệp ${fileName} từ đường dẫn trực tuyến.`,
        };
      }
    } catch (e: any) {
      return { success: false, documents: [], message: `Không thể tải từ URL: ${e.message}` };
    }
  }

  return {
    success: false,
    documents: [],
    message: "Định dạng đường dẫn không hợp lệ. Vui lòng nhập link Thư mục Google Drive (https://drive.google.com/drive/folders/...) hoặc link Google Doc.",
  };
}

// Track models that have exceeded quota (HTTP 429 / RESOURCE_EXHAUSTED) to prevent repeated failures
const modelExhaustedUntil: Record<string, number> = {};

function markModelExhausted(model: string, retrySeconds: number = 60) {
  modelExhaustedUntil[model] = Date.now() + Math.max(retrySeconds * 1000, 30000);
}

function isModelExhausted(model: string): boolean {
  const until = modelExhaustedUntil[model];
  if (!until) return false;
  if (Date.now() > until) {
    delete modelExhaustedUntil[model];
    return false;
  }
  return true;
}

// Return prioritized list of fallback models to survive 503/429 spikes and long stalls
function getResilientModelList(requestedModel?: string, enableThinking: boolean = false): string[] {
  if (enableThinking) {
    // Khi bật High Thinking: bắt buộc kích hoạt gemini-3.8-flash, nếu fail thì gọi gemini-3.6-flash.
    // Nếu fail nữa thì báo lỗi rõ ràng ra luôn. Không hạ model thêm nữa!
    return ["gemini-3.8-flash", "gemini-3.6-flash"];
  }

  // Model chuyên dụng cho lập trình pyRevit:
  // Tốc độ cao, tối ưu code Python, hoàn toàn miễn phí, quota dồi dào không bị limit
  if (requestedModel === "pyrevit-code-pro" || requestedModel === "pyrevit-code-specialist") {
    return ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
  }

  // Nếu High Thinking tắt: dùng mặc định 3.6 flash, nếu fail thì đưa về Flash Lite để đảm bảo luôn có phản hồi!
  let primary = requestedModel || "gemini-3.6-flash";
  if (primary === "gemini-flash-lite-latest") {
    primary = "gemini-3.1-flash-lite";
  }

  // Pool dự phòng đảm bảo luôn có phản hồi:
  // Nếu 3.6 Flash gặp sự cố hoặc nghẽn quota, hệ thống tự động fallback tức thì sang Flash Lite
  const fallbackPool = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
  ];

  const ordered = [primary, ...fallbackPool.filter((m) => m !== primary)];

  // Filter out any models currently in quota or 503 cooldown unless all are exhausted
  const available = ordered.filter((m) => !isModelExhausted(m));
  return available.length > 0 ? available : ordered;
}

// Sync Google Drive or public URL knowledge base endpoint for pyRevit Coder
app.post("/api/pyrevit/sync-drive", async (req, res) => {
  try {
    const { driveFolderUrl } = req.body;
    if (!driveFolderUrl) {
      res.status(400).json({ success: false, documents: [], message: "Vui lòng cung cấp đường dẫn Google Drive." });
      return;
    }

    const result = await syncGoogleDrivePublicUrl(driveFolderUrl);
    res.json(result);
  } catch (error: any) {
    console.error("pyRevit Drive sync error:", error);
    res.status(500).json({
      success: false,
      documents: [],
      message: error.message || "Đã xảy ra lỗi khi đồng bộ thư mục Google Drive.",
    });
  }
});

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post("/api/gemini/stream", async (req, res) => {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    enableSearch = false,
    model = "gemini-3.6-flash",
    systemInstruction,
    pyRevitContext,
  } = req.body;

  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: "Yêu cầu phải có câu lệnh (prompt) hoặc hình ảnh." });
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const ai = getAIClient();
  const contents = formatContents(prompt, history, images);
  const candidateModels = getResilientModelList(model, enableThinking);

  let fallbackReason = "";
  let isWebSearchFallback = false;
  let fallbackGroundingSources: { title: string; uri: string }[] = [];
  let fallbackWebSearchQueries: string[] = [];

  let searchContext = "";
  if (enableSearch && prompt) {
    try {
      const searchResults = await fetchLiveWebSearch(prompt);
      if (searchResults.length > 0) {
        isWebSearchFallback = true;
        fallbackGroundingSources = searchResults.map((r) => ({ title: r.title, uri: r.uri }));
        fallbackWebSearchQueries = [prompt.slice(0, 100)];
        searchContext = `\n\n[KẾT QUẢ TÌM KIẾM WEB THỜI GIAN THỰC CHO: "${prompt}"]:\n` +
          searchResults.map((r, i) => `[${i + 1}] Tiêu đề: ${r.title}\nURL: ${r.uri}\nTóm tắt: ${r.snippet}`).join("\n\n") +
          `\nHãy sử dụng các kết quả tìm kiếm thời gian thực ở trên để trả lời câu hỏi của người dùng một cách chính xác, cập nhật nhất và trích dẫn rõ ràng.`;
        fallbackReason = "Đã sử dụng công cụ Live Web Search để tra cứu dữ liệu mới nhất trực tuyến.";

        // Send search grounding sources immediately so the UI displays search chips and links right away
        res.write(`data: ${JSON.stringify({
          text: "",
          thought: "",
          model: candidateModels[0],
          fallbackReason: "Đã tra cứu dữ liệu web thời gian thực trực tuyến.",
          groundingSources: fallbackGroundingSources,
          webSearchQueries: fallbackWebSearchQueries,
        })}\n\n`);
      }
    } catch (searchErr) {
      console.warn("Live web search fetch failed:", searchErr);
    }
  }

  const isPyRevitModel = model === "pyrevit-code-pro" || model === "pyrevit-code-specialist";
  const pyRevitKnowledge = buildPyRevitKnowledgeContext(pyRevitContext);
  const baseInstruction =
    (systemInstruction ? systemInstruction + "\n" : "") +
    (isPyRevitModel ? PYREVIT_SPECIALIST_INSTRUCTION + "\n" : "") +
    pyRevitKnowledge +
    searchContext;

  const configPayload: any = {
    systemInstruction: getRealtimeSystemInstruction(baseInstruction),
  };

  if (enableThinking) {
    configPayload.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH,
    };
  }

  let activeModelUsed = candidateModels[0];
  let iterator: any = null;
  let firstChunkVal: any = null;
  let lastStreamError: any = null;

  // Try candidate models in resilient priority order with an adaptive watchdog on first chunk
  const watchdogMs = enableThinking ? 18000 : 9000;
  for (const candModel of candidateModels) {
    let attempts = 0;
    const maxAttempts = candModel === "gemini-3.8-flash" ? 2 : 1;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const streamAttempt = await ai.models.generateContentStream({
          model: candModel,
          contents,
          config: configPayload,
        });

        const iter = streamAttempt[Symbol.asyncIterator]();
        let timer: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
          timer = setTimeout(() => resolve({ timeout: true }), watchdogMs);
        });

        const firstResult: any = await Promise.race([
          iter.next().then((val: any) => ({ timeout: false, val })),
          timeoutPromise,
        ]);

        if (timer) clearTimeout(timer);

        if (firstResult.timeout) {
          lastStreamError = new Error(`Mô hình ${candModel} phản hồi quá thời gian chờ (${watchdogMs / 1000}s).`);
          console.warn(`Model ${candModel} timed out on first chunk (>${watchdogMs}ms), switching to next model...`);
          break;
        }

        activeModelUsed = candModel;
        iterator = iter;
        firstChunkVal = firstResult.val;
        if (candModel !== candidateModels[0]) {
          fallbackReason = `Mô hình ${candidateModels[0]} phản hồi chậm hoặc đang bảo trì, đã tự động chuyển sang ${candModel}.`;
        }
        break;
      } catch (err: any) {
        lastStreamError = err;
        const is503 =
          err?.status === 503 ||
          err?.message?.includes("503") ||
          err?.message?.includes("experiencing high demand") ||
          err?.message?.includes("UNAVAILABLE");

        if (is503 && attempts < maxAttempts) {
          console.warn(`Model ${candModel} hit 503 high demand, waiting 1s for transient retry...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const is429 =
          err?.status === 429 ||
          err?.message?.includes("429") ||
          err?.message?.includes("RESOURCE_EXHAUSTED") ||
          err?.message?.includes("Quota exceeded");

        if (is429) {
          let retrySeconds = 60;
          const match =
            err?.message?.match(/retry in ([0-9]+)/i) ||
            err?.message?.match(/retryDelay"?:\s*"([0-9]+)s?"/i);
          if (match && match[1]) {
            retrySeconds = Math.max(parseInt(match[1], 10), 30);
          }
          if (err?.message?.includes("limit: 20")) {
            retrySeconds = 1800; // Free-tier daily limit cooldown
          }
          markModelExhausted(candModel, retrySeconds);
          console.warn(`Model ${candModel} quota exceeded (429), cooling down for ${retrySeconds}s. Trying fallback model...`);
        } else if (is503) {
          markModelExhausted(candModel, 60); // 60s cooldown for 503 high demand spikes
          console.warn(`Model ${candModel} high demand (503), cooling down for 60s. Trying next model...`);
        } else {
          console.warn(`Stream attempt for model ${candModel} failed (${err?.status || err?.code || 'error'}), trying fallback...`);
        }
        break;
      }
    }
    if (iterator) break;
  }

  // If streaming couldn't be initialized on any model:
  if (!iterator) {
    if (enableThinking) {
      // In High Thinking mode: strictly report the error without redundant non-streaming failures or degrading to lite models
      const cleanMsg = formatThinkingFailureError(lastStreamError);
      res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    console.log("All streaming initializations failed or timed out. Attempting non-streaming fallback...");
    for (const candModel of candidateModels) {
      if (isModelExhausted(candModel)) continue;
      try {
        const directResp = await ai.models.generateContent({
          model: candModel,
          contents,
          config: configPayload,
        });
        const textOut = directResp.text || "";
        if (textOut) {
          res.write(`data: ${JSON.stringify({
            text: textOut,
            model: candModel,
            fallbackReason: `Đã kết nối qua kênh dự phòng ${candModel}.`,
            groundingSources: fallbackGroundingSources.length > 0 ? fallbackGroundingSources : undefined,
            webSearchQueries: fallbackWebSearchQueries.length > 0 ? fallbackWebSearchQueries : undefined,
          })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
        }
      } catch (directErr: any) {
        lastStreamError = directErr;
        const is429 =
          directErr?.status === 429 ||
          directErr?.message?.includes("429") ||
          directErr?.message?.includes("RESOURCE_EXHAUSTED") ||
          directErr?.message?.includes("Quota exceeded");
        if (is429) {
          markModelExhausted(candModel, 300);
        }
        console.warn(`Direct generateContent attempt for ${candModel} failed:`, directErr?.status || directErr?.code || directErr?.message?.slice(0, 80));
      }
    }

    const cleanMsg = extractErrorMessage(lastStreamError);
    res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
    return;
  }

  // Stream output to client
  let totalTextReceived = "";
  let totalThoughtReceived = "";

  const processChunk = (chunk: any) => {
    let textChunk = "";
    let thoughtChunk = "";

    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts && Array.isArray(parts)) {
      for (const part of parts) {
        if ((part as any).thought) {
          thoughtChunk += (part as any).text || "";
        } else if (part.text) {
          textChunk += part.text;
        }
      }
    }

    if (!textChunk && !thoughtChunk && chunk.text) {
      textChunk = chunk.text;
    }

    totalTextReceived += textChunk;
    totalThoughtReceived += thoughtChunk;

    // Extract grounding sources & search queries
    const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
    let groundingSources = fallbackGroundingSources.length > 0 ? fallbackGroundingSources : undefined;
    let webSearchQueries = fallbackWebSearchQueries.length > 0 ? fallbackWebSearchQueries : undefined;

    if (groundingMetadata?.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
      const nativeSources = groundingMetadata.groundingChunks
        .map((c: any) => ({
          title: c.web?.title || c.title || "Trang web",
          uri: c.web?.uri || c.uri || "",
        }))
        .filter((s: any) => s.uri);
      if (nativeSources.length > 0) {
        groundingSources = nativeSources;
      }
    }

    if (groundingMetadata?.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
      webSearchQueries = groundingMetadata.webSearchQueries;
    }

    const payload = {
      text: textChunk,
      thought: thoughtChunk,
      model: isPyRevitModel ? "pyrevit-code-pro" : activeModelUsed,
      fallbackReason: fallbackReason || undefined,
      groundingSources: groundingSources && groundingSources.length > 0 ? groundingSources : undefined,
      webSearchQueries: webSearchQueries && webSearchQueries.length > 0 ? webSearchQueries : undefined,
    };

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    if (firstChunkVal && !firstChunkVal.done && firstChunkVal.value) {
      processChunk(firstChunkVal.value);
    }

    while (true) {
      const nextItem = await iterator.next();
      if (nextItem.done) break;
      if (nextItem.value) {
        processChunk(nextItem.value);
      }
    }

    // Safety check: If stream finished with 0 text (e.g. tool output only without final candidate text)
    if (!totalTextReceived.trim()) {
      console.log("Empty text stream detected. Generating non-streaming response fallback across candidate models...");
      let fallbackSucceeded = false;
      for (const fallbackModel of candidateModels) {
        try {
          const nonStreamResp = await ai.models.generateContent({
            model: fallbackModel,
            contents,
            config: {
              systemInstruction: getRealtimeSystemInstruction(systemInstruction) + searchContext,
            },
          });

          const fallbackText = nonStreamResp.text || "";
          if (fallbackText) {
            res.write(`data: ${JSON.stringify({
              text: fallbackText,
              model: fallbackModel,
              fallbackReason: fallbackModel !== candidateModels[0] ? `Đã chuyển sang ${fallbackModel} do mô hình chính quá tải.` : undefined,
              groundingSources: fallbackGroundingSources.length > 0 ? fallbackGroundingSources : undefined,
              webSearchQueries: fallbackWebSearchQueries.length > 0 ? fallbackWebSearchQueries : undefined,
            })}\n\n`);
            fallbackSucceeded = true;
            break;
          }
        } catch (err: any) {
          console.warn(`Non-stream fallback attempt with ${fallbackModel} failed:`, err?.message);
        }
      }

      if (!fallbackSucceeded) {
        res.write(`data: ${JSON.stringify({ error: "Mô hình AI hiện đang nhận lượng truy cập cao (503). Vui lòng gửi lại sau giây lát." })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Gemini Stream Chunk Error:", error);

    // If stream failed during execution and we got no text yet, recover immediately!
    if (!totalTextReceived.trim()) {
      let recoverySucceeded = false;
      for (const recoveryModel of candidateModels) {
        try {
          console.log(`Attempting stream recovery using ${recoveryModel}...`);
          const recoveryResp = await ai.models.generateContent({
            model: recoveryModel,
            contents,
            config: {
              systemInstruction: getRealtimeSystemInstruction(systemInstruction) + searchContext,
            },
          });

          if (recoveryResp.text) {
            res.write(`data: ${JSON.stringify({
              text: recoveryResp.text,
              model: recoveryModel,
              fallbackReason: `Đã tự động khôi phục câu trả lời qua ${recoveryModel}.`,
              groundingSources: fallbackGroundingSources.length > 0 ? fallbackGroundingSources : undefined,
              webSearchQueries: fallbackWebSearchQueries.length > 0 ? fallbackWebSearchQueries : undefined,
            })}\n\n`);
            recoverySucceeded = true;
            break;
          }
        } catch (recErr: any) {
          console.warn(`Recovery attempt with ${recoveryModel} failed:`, recErr?.message);
        }
      }

      if (recoverySucceeded) {
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }
    }

    const errorMessage = extractErrorMessage(error);
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

// Non-streaming chat endpoint (standard JSON)
app.post("/api/gemini/generate", async (req, res) => {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    enableSearch = false,
    model = "gemini-3.6-flash",
    systemInstruction,
    pyRevitContext,
  } = req.body;

  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: "Yêu cầu phải có câu lệnh (prompt) hoặc hình ảnh." });
    return;
  }

  try {
    const ai = getAIClient();
    const candidateModels = getResilientModelList(model, enableThinking);

    let searchContext = "";
    let fallbackGroundingSources: { title: string; uri: string }[] = [];
    let fallbackWebSearchQueries: string[] = [];
    let fallbackNotice = "";

    if (enableSearch && prompt) {
      try {
        const searchResults = await fetchLiveWebSearch(prompt);
        if (searchResults.length > 0) {
          fallbackGroundingSources = searchResults.map((r) => ({ title: r.title, uri: r.uri }));
          fallbackWebSearchQueries = [prompt.slice(0, 100)];
          searchContext = `\n\n[KẾT QUẢ TÌM KIẾM WEB THỜI GIAN THỰC CHO: "${prompt}"]:\n` +
            searchResults.map((r, i) => `[${i + 1}] ${r.title} (${r.uri})\n${r.snippet}`).join("\n\n") +
            `\nHãy sử dụng các kết quả tìm kiếm mới nhất này để trả lời đầy đủ, chi tiết cho người dùng.`;
          fallbackNotice = "Đã tra cứu dữ liệu web thời gian thực trực tuyến.";
        }
      } catch (e) {
        console.warn("Live web search fetch failed in generate:", e);
      }
    }

    const isPyRevitModel = model === "pyrevit-code-pro" || model === "pyrevit-code-specialist";
    const pyRevitKnowledge = isPyRevitModel ? buildPyRevitKnowledgeContext(pyRevitContext) : "";
    const baseInstruction =
      (systemInstruction ? systemInstruction + "\n" : "") +
      (isPyRevitModel ? PYREVIT_SPECIALIST_INSTRUCTION + "\n" : "") +
      pyRevitKnowledge +
      searchContext;

    const configPayload: any = {
      systemInstruction: getRealtimeSystemInstruction(baseInstruction),
    };

    if (enableThinking) {
      configPayload.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    const contents = formatContents(prompt, history, images);
    let activeModel = candidateModels[0];
    let response: any = null;
    let lastError: any = null;

    for (const candModel of candidateModels) {
      if (!enableThinking && isModelExhausted(candModel)) continue;
      try {
        response = await ai.models.generateContent({
          model: candModel,
          contents,
          config: configPayload,
        });
        activeModel = candModel;
        if (candModel !== candidateModels[0]) {
          fallbackNotice = `Đã tự động tối ưu và chuyển sang kết nối ${candModel}.`;
        }
        break;
      } catch (candErr: any) {
        lastError = candErr;
        const is429 =
          candErr?.status === 429 ||
          candErr?.message?.includes("429") ||
          candErr?.message?.includes("RESOURCE_EXHAUSTED") ||
          candErr?.message?.includes("Quota exceeded");
        const is503 =
          candErr?.status === 503 ||
          candErr?.message?.includes("503") ||
          candErr?.message?.includes("experiencing high demand") ||
          candErr?.message?.includes("UNAVAILABLE");

        if (is429) {
          markModelExhausted(candModel, 1800);
          console.warn(`Model ${candModel} quota exceeded (429), marked for cooldown and trying fallback...`);
        } else if (is503) {
          markModelExhausted(candModel, 60);
          console.warn(`Model ${candModel} high demand (503), marked for cooldown and trying fallback...`);
        } else {
          console.warn(`GenerateContent error with model ${candModel} (trying next):`, candErr?.status || candErr?.code || candErr?.message?.slice(0, 80));
        }
      }
    }

    if (!response) {
      if (enableThinking) {
        res.status(500).json({ error: formatThinkingFailureError(lastError) });
        return;
      }
      throw lastError || new Error("Không thể kết nối đến mô hình AI.");
    }

    let mainText = "";
    let thoughtText = "";

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && Array.isArray(parts)) {
      for (const part of parts) {
        if ((part as any).thought) {
          thoughtText += (part as any).text || "";
        } else if (part.text) {
          mainText += part.text;
        }
      }
    }

    if (!mainText && response.text) {
      mainText = response.text;
    }

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let groundingSources = fallbackGroundingSources.length > 0 ? fallbackGroundingSources : undefined;
    let webSearchQueries = fallbackWebSearchQueries.length > 0 ? fallbackWebSearchQueries : undefined;

    if (groundingMetadata?.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
      const nativeSources = groundingMetadata.groundingChunks
        .map((c: any) => ({
          title: c.web?.title || c.title || "Trang web",
          uri: c.web?.uri || c.uri || "",
        }))
        .filter((s: any) => s.uri);
      if (nativeSources.length > 0) {
        groundingSources = nativeSources;
      }
    }

    if (groundingMetadata?.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
      webSearchQueries = groundingMetadata.webSearchQueries;
    }

    res.json({
      text: mainText,
      thought: thoughtText,
      model: isPyRevitModel ? "pyrevit-code-pro" : activeModel,
      fallbackNotice: fallbackNotice || undefined,
      groundingSources: groundingSources && groundingSources.length > 0 ? groundingSources : undefined,
      webSearchQueries: webSearchQueries && webSearchQueries.length > 0 ? webSearchQueries : undefined,
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error("Gemini Generate Error:", error);
    res.status(500).json({
      error: extractErrorMessage(error),
    });
  }
});

async function startServer() {
  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
