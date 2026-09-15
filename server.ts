import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { DEFAULT_MYMEPTOOLS_CONTENT } from "./src/data/defaultPyRevitKnowledge";

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
Bạn là trợ lý lập trình chuyên sâu về pyRevit và Revit API (pyRevit Senior Developer & BIM Automation Specialist cho dự án MyMEPTools.extension).
Bạn được xây dựng trên nền tảng Gemini 3.6 Flash (tự động chuyển đổi sang Gemini 3.1 Flash Lite khi vượt quá hạn ngạch) để phân tích và nhả code chính xác nhất.

📌 BẮT BUỘC Ở DÒNG ĐẦU TIÊN CỦA MỌI CÂU TRẢ LỜI:
Bạn PHẢI LUÔN THAM CHIẾU VÀ ĐỐI CHIẾU VỚI CẢ 2 BỘ TÀI LIỆU QUY CHUẨN ĐÃ NẠP:
1. QUY_CHUAN_WPF_VA_CHONG_SAP_MODEL_MyMEPTools.md (Giao diện WPF chuẩn & 10 Quy tắc chống sập model)
2. TONG_HOP_KIEN_THUC_MyMEPTools.md (Kiến thức nền pyRevit, Revit API, lib/plumbing_pro.py & cấu trúc extension)

Và ghi rõ ở dòng 1:
"📌 **Đã tham chiếu & đối chiếu 2 bộ tài liệu quy chuẩn MyMEPTools (WPF UI, Chống sập model & Kiến thức nền pyRevit/API)**"

Quy tắc viết code bắt buộc:
1. Môi trường: Tối ưu cho pyRevit (Python 3).
2. Biến khởi tạo: 
   from pyrevit import revit, DB, forms
   doc = revit.doc
   uidoc = revit.uidoc
3. Transaction: Mọi thao tác sửa đổi Revit Model phải bọc trong:
   with revit.Transaction("Tên Thao Tác"):
       # logic code
4. Cú pháp API: Nếu cần dùng ICollection, hãy import System.Collections.Generic và khởi tạo List[DB.ElementId]().
5. Output: Trả về trực tiếp khối code Python sạch, ngắn gọn, có comment tiếng Việt giải thích logic chính, kèm vị trí lưu file trong extension (.extension/.tab/.panel/.pushbutton/script.py).
6. Tuân thủ 100% 2 bộ quy chuẩn (Palette chuẩn Light Premium Dashboard, lib/plumbing_pro.py, quy đổi đơn vị 304.8 ft/mm, Regenerate() sau BreakCurve).
`;

// Helper to format knowledge base documents for pyRevit Coder & Gemini
const BUILTIN_MYMEPTOOLS_CONTENT = `# 📘 TỔNG HỢP KIẾN THỨC — MyMEPTools.extension

> Tài liệu tổng hợp toàn bộ tool pyRevit trong dự án: cấu trúc, quy trình hoạt động, cách dùng hàm và các lưu ý quan trọng.
> **Tác giả:** Dong Tran Ba (BIMer) — Cập nhật: 2026
> **Nền tảng:** pyRevit (IronPython 2.7) + Revit API, giao diện WPF / WinForms

---

## MỤC LỤC

1. [Tổng quan dự án & cấu trúc thư mục](#1-tổng-quan-dự-án--cấu-trúc-thư-mục)
2. [Quy ước pyRevit: bundle, pushbutton, stack](#2-quy-ước-pyrevit-bundle-pushbutton-stack)
3. [Kiến thức nền chung (bắt buộc đọc)](#3-kiến-thức-nền-chung)
4. [Thư viện dùng chung \`lib/plumbing_pro.py\`](#4-thư-viện-dùng-chung-libplumbing_propy)
5. [Panel **Dong's Tool** (chi tiết từng tool)](#5-panel-dongs-tool)
6. [Panel **Model Tool** (bẻ co 90°/45° đa năng)](#6-panel-model-tool)
7. [Panel **Plumbing** (nối ống thoát nước)](#7-panel-plumbing)
8. [Quy trình phát triển tool mới trong dự án](#8-quy-trình-phát-triên-tool-mới)
9. [Sổ tay lưu ý & lỗi hay gặp](#9-sổ-tay-lưu-ý--lỗi-hay-gặp)

---

## 1. Tổng quan dự án & cấu trúc thư mục

### 1.1. Bản chất
Đây là **1 extension pyRevit** tên \`MyMEPTools.extension\`, chứa 3 panel công cụ MEP:

| Panel | Chủ đề | Số lượng tool |
|---|---|---|
| **Dong's Tool** | Tiện ích tổng hợp: BOQ, Clash, Color, Tag, Dim, Align, Connect Sprinkler, Excel… | ~20 tool (7 stack + 1 nút lẻ) |
| **Model Tool** | Bẻ co 90°/45° LÊN/XUỐNG/TRÁI/PHẢI cho Pipe / Duct / Cable Tray + Utility nối/ngắt | 13 nút (5 stack) |
| **Plumbing** | Nối ống thoát nước (drainage): Branch 2/3/4/5/7/8, AxisPipe, BranchPipe1, Connect Fixture, Vent Riser | 10 nút |

### 1.2. Cây thư mục

\`\`\`
MyMEPTools.extension\\                      ← thư mục gốc extension (tên bắt buộc đuôi .extension)
├── startup.py                             ← script chạy khi load extension (cửa sổ chào hỏi)
├── ui.xaml                                ← XAML của cửa sổ chào hỏi
├── lib\\
│   └── plumbing_pro.py                    ← ★ THƯ VIỆN DÙNG CHUNG cho toàn bộ tool Plumbing
└── Dong Tran Ba.tab\\                      ← Tab trên Ribbon
    ├── Dong's Tool.panel\\
    │   ├── 1.stack\\ ... 7.stack\\          ← stack xếp dọc các pushbutton
    │   └── Sheet & View Manager.pushbutton\\
    ├── Model Tool.panel\\                  ← có bundle.yaml riêng định nghĩa layout
    │   ├── Up Down.stack\\ Left Right.stack\\ 45 Up Down.stack\\ 45 Left Right.stack\\ Utility.stack\\
    └── Plumbing.panel\\
        ├── Branch 5 / Branch 7 / Branch 8 .pushbutton\\
        ├── Drainage.stack\\ (AxisPipe, BranchPipe1, Connect Fixture)
        ├── Drainage2.stack\\ (Branch 2, Branch 3, Branch 4)
        └── Vent Riser.pushbutton\\
\`\`\`

**Quy ước đặt tên thư mục:**
- Tab phải đuôi \`.tab\`, panel đuôi \`.panel\`, nhóm nút đuôi \`.stack\`, nút đuôi \`.pushbutton\` — pyRevit nhận diện **qua đuôi thư mục**, sai đuôi là không load.
- Tên hiển thị trên Ribbon được lấy từ \`bundle.yaml\` (mục \`title\`), hỗ trợ \`\\n\` để xuống 2 dòng.
- Icon: file \`icon.png\` (32x32) đặt trong thư mục pushbutton.
- Script chính **bắt buộc** tên \`script.py\` nằm trong thư mục pushbutton.
- Giao diện: \`ui.xaml\` cùng thư mục — \`forms.WPFWindow('ui.xaml')\` tự tìm file XAML cùng thư mục với script.
- Cảnh báo/kết quả: có thể dùng file XAML phụ riêng (VD: \`alert.xaml\`, \`AlignResult.xaml\`, \`ZLevelPickerWindow.xaml\`).

### 1.3. \`startup.py\` (cửa sổ chào hỏi khi khởi động)
- pyRevit tự chạy \`startup.py\` khi load extension. Nó import WPF (\`PresentationCore/Framework\`), định nghĩa class \`ChaoDongWindow(WPFWindow)\` rồi \`window.Show()\` (modeless).
- Gắn sự kiện: nút Close/Ok, nút "Chào lại", và phím **ESC** qua \`self.KeyDown += self.on_key_down\` (kiểm tra \`e.Key == System.Windows.Input.Key.Escape\`).
- Có hiệu ứng **fade-in** bằng \`Storyboard\` + \`DoubleAnimation\` trong \`ui.xaml\`.
- Lưu ý: cùng một class trong \`6.stack\\Chao Dong.pushbutton\` nhưng dùng \`ShowDialog()\` (modal).

### 1.4. Cách access document — 2 phong cách song song trong dự án

\`\`\`python
# Phong cách 1: qua __revit__ (dùng nhiều ở tool cũ)
doc   = __revit__.ActiveUIDocument.Document
uidoc = __revit__.ActiveUIDocument

# Phong cách 2: qua module pyrevit (tool mới, gọn hơn)
from pyrevit import revit
doc, uidoc = revit.doc, revit.uidoc
\`\`\`

---

## 2. Quy ước pyRevit: bundle, pushbutton, stack

### 2.1. \`bundle.yaml\`
Mỗi pushbutton có thể có \`bundle.yaml\` khai báo metadata:

\`\`\`yaml
title: "MEP BOQ\\nDashboard"     # tên nút (\\n = xuống dòng)
tooltip: "The Ultimate Quantity Takeoff Engine"
author: "Dong Tran Ba (BIMer)"
context: zero-doc               # chạy được cả khi KHÔNG mở file Revit
\`\`\`

- \`context: zero-doc\` dùng cho tool giao diện thuần (BOQ Pro, BOQ 3D Pro, Excel Synch, Chao Dong).
- Panel \`Model Tool.panel\` có \`bundle.yaml\` khai báo \`layout:\` liệt kê thứ tự các stack.

### 2.2. \`stack\`
- Thư mục đuôi \`.stack\` xếp các nút **ngang** (nếu tên bắt đầu bằng số \`1.stack\`, \`2.stack\`… thì pyRevit giữ đúng thứ tự và gộp thành dãy nút mảnh).
- Stack con có thể có \`bundle.yaml\` riêng chỉ dùng \`title\` + \`tooltip\` (VD: "Bẻ co 45 độ LÊN/XUỐNG (giữ độ dốc) cho Pipe / Duct / Cable Tray").

### 2.3. Metadata script.py
Hai dòng đầu hay dùng:

\`\`\`python
__title__ = "Align & Connect\\nSprinkler"   # tên hiển thị (ghi đè bundle.yaml)
__doc__   = "Mô tả ngắn tool"
\`\`\`

## 3. Kiến thức nền chung

> Phần này là **mẫu thiết kế chung** lặp lại trong hầu hết tool. Hiểu được phần này là đọc code tool nào cũng hiểu.

### 3.1. Đơn vị — Revit nội bộ dùng FEET
- Mọi toạ độ, đường kính, khoảng cách đọc/tạo từ API đều theo **feet**.
- Quy ước dự án: \`MM_PER_FOOT = 304.8\`, hàm \`mm_to_feet(mm) = mm / 304.8\`.
- Lấy input người dùng (mm) → chia 304.8 trước khi dùng (VD: Auto Split Duct \`max_length_mm / 304.8\`, 45° elbow \`offset_val = float(offset_mm) / 304.8\`).

### 3.2. ElementId — tương thích Revit 2024+
\`\`\`python
def _eid_int(eid):
    try:    return eid.Value          # Revit 2024+ (Int64)
    except AttributeError:
        return eid.IntegerValue       # Revit cũ (Int32)
\`\`\`
- Tạo ngược lại: \`ElementId(System.Int64(id))\` → fallback \`ElementId(int(id))\` (xem BOQ Pro \`internal_create_id\`).
- Kiểm tra phiên bản: \`IS_REVIT_2024_OR_NEWER = hasattr(DB.ElementId, "Value")\`.

### 3.3. Connector (đầu nối MEP) — trái tim của mọi tool MEP
\`\`\`python
def get_connectors(el):
    if hasattr(el, "ConnectorManager"):            # MEPCurve: Pipe / Duct / CableTray / Conduit
        return list(el.ConnectorManager.Connectors)
    elif el.MEPModel:                              # FamilyInstance: fitting / thiết bị / sprinkler
        return list(el.MEPModel.ConnectorManager.Connectors)
\`\`\`

Quy tắc bắt buộc khi làm việc với connector:
1. **Luôn bỏ connector ảo**: \`if c.ConnectorType == ConnectorType.Logical: continue\` — connector Logical là connector "hệ thống" (đếm số, thông tin), KHÔNG dùng để nối hình học.
2. Kiểm tra \`c.IsConnected\` trước khi dùng (connector còn trống mới cắm được).
3. \`c.Origin\` = toạ độ điểm nối; \`c.CoordinateSystem.BasisZ\` = hướng cổ nối.
4. \`c.AllRefs\` = danh sách connector đang cắm vào nó (duyệt ra phần tử đối diện: \`ref.Owner\`).
5. Chọn connector **gần điểm đích nhất** theo khoảng cách, đừng đoán index.

### 3.4. Các hàm tạo/nối/phá chuẩn dùng trong dự án

| Mục đích | Hàm |
|---|---|
| Tạo ống nước | \`Pipe.Create(doc, sys_type_id, pipe_type_id, level_id, pt0, pt1)\` |
| Tạo ống gió | \`Duct.Create(doc, sys_type_id, type_id, level_id, pt0, pt1)\` |
| Tạo máng cáp | \`CableTray.Create(doc, type_id, pt0, pt1, level_id)\` |
| Tạo ống luồn | \`Electrical.Conduit.Create(doc, type_id, pt0, pt1, level_id)\` |
| Cắt ống nước | \`PlumbingUtils.BreakCurve(doc, pipe_id, pt)\` → trả Id đoạn mới |
| Cắt ống gió | \`Mechanical.MechanicalUtils.BreakCurve(doc, duct_id, pt)\` |
| Chèn Co (2 cổ) | \`doc.Create.NewElbowFitting(conn1, conn2)\` |
| Chèn Tê (3 cổ) | \`doc.Create.NewTeeFitting(conn1, conn2, conn3)\` |
| Chèn Union | \`doc.Create.NewUnionFitting(conn1, conn2)\` |
| Nối thủ công | \`connA.ConnectTo(connB)\` |
| Ngắt thủ công | \`connA.DisconnectFrom(connB)\` |
| Di chuyển / Xoay | \`ElementTransformUtils.MoveElement\` / \`RotateElement(doc, id, axis_line, angle_rad)\` |
| Kéo dài/thụt ống | \`element.Location.Curve = Line.CreateBound(pt0, pt1)\` |

⚠️ **Phải gọi \`doc.Regenerate()\` sau khi tạo/sửa hình học, TRƯỚC khi lấy lại connector** — nếu không connector chưa sinh ra, tool lỗi "không tìm thấy connector".

### 3.5. Transaction — 3 mức trong dự án

\`\`\`python
# Mức 1: pyRevit context manager (tool nhỏ)
with revit.Transaction("Tên lệnh"):
    ...

# Mức 2: Transaction thủ công + chống warning (Plumbing)
t = Transaction(doc, "Branch Pipe 5"); t.Start()
opts = t.GetFailureHandlingOptions()
opts.SetFailuresPreprocessor(SuppressWarnings())   # nuốt mọi Warning vàng
t.SetFailuresPreprocessor(opts)
...
t.Commit()   # lỗi thì t.RollBack()

# Mức 3: TransactionGroup (nhiều transaction → 1 lần Undo duy nhất, chống lag)
tg = TransactionGroup(doc, "Auto Split Ducts"); tg.Start()
for item in items:
    t = Transaction(doc, "..."); t.Start(); ...; t.Commit()
tg.Assimilate()          # gộp toàn bộ thành 1 lệnh Undo
# nếu lỗi nghiêm trọng: tg.RollBack() → trả file về như chưa chạy
\`\`\`

### 3.6. Bộ chặn cảnh báo \`SuppressWarnings\` (chuẩn dự án)

\`\`\`python
class SuppressWarnings(IFailuresPreprocessor):
    def PreprocessFailures(self, failuresAccessor):
        for f in failuresAccessor.GetFailureMessages():
            if f.GetSeverity() == FailureSeverity.Warning:
                failuresAccessor.DeleteWarning(f)      # tự xóa cảnh báo vàng
        return FailureProcessingResult.Continue
\`\`\`
- Gắn vào transaction bằng \`options.SetFailuresPreprocessor(SuppressWarnings())\`.
- Mục đích: khi chèn fitting hàng loạt Revit hay phê warning chặn luồng — preprocessor nuốt hết để chạy ẩn. Lỗi Error vẫn xử lý bình thường.

### 3.7. Chọn đối tượng (\`PickObject\` / \`PickObjects\` + \`ISelectionFilter\`)

\`\`\`python
from Autodesk.Revit.UI.Selection import ObjectType, ISelectionFilter

class PipeSelectionFilter(ISelectionFilter):
    def AllowElement(self, elem):
        return elem.Category.Id.IntegerValue == int(BuiltInCategory.OST_PipeCurves)
    def AllowReference(self, ref, pos): return False   # chặn pick reference

refs = uidoc.Selection.PickObjects(ObjectType.Element, PipeSelectionFilter(),
                                   "Quét chọn ống, bấm Finish…")
# 1 đối tượng: PickObject | nhiều: PickObjects | điểm trên element: ObjectType.PointOnElement
\`\`\`

- Bắt phím hủy: \`except OperationCanceledException: sys.exit()\` (từ \`Autodesk.Revit.Exceptions\`).
- Hỗ trợ quét trước khi bấm tool: \`uidoc.Selection.GetElementIds()\` — có sẵn selection thì dùng luôn, không thì mới Pick (Align Spk, Connect to, Disconnect, Z-SKIP).
- Tính năng **SHIFT-click**: \`globals().get('__shiftclick__', False)\` (BranchPipe1: giữ Shift = chạy Test chỉ dựng hình học, không sinh fitting).

### 3.8. WPF Window (\`forms.WPFWindow\`)

\`\`\`python
class MyWindow(forms.WPFWindow):
    def __init__(self, xaml_file_name):
        forms.WPFWindow.__init__(self, xaml_file_name)   # wire sẵn mọi control theo x:Name
        self.BtnRun.Click += self.btn_run_Click
        self.IsRunClicked = False                        # cờ: user đã bấm Run chưa

w = MyWindow("ui.xaml")      # hoặc tuyệt đối: os.path.join(os.path.dirname(__file__), 'ui.xaml')
w.ShowDialog()               # modal → code dừng chờ
w.Show()                     # modeless (cần ExternalEvent, xem 3.9)
\`\`\`

Mẫu UI thường gặp:
- **Title bar tự chế**: \`WindowStyle="None" AllowsTransparency="True"\` + \`self.DragZone.MouseLeftButtonDown += ... self.DragMove()\`.
- **ESC đóng cửa sổ**: \`self.KeyDown += self.on_key_down\`, so sánh \`System.Windows.Input.Key.Escape\`.
- **Đọc control**: \`self.txtLength.Text\`, \`self.cmbOption.SelectedItem.Content\`.
- **DataSource**: gán \`ItemsSource\` với list object có **property công khai** (binding WPF cần property, VD \`DisplayName\`, \`IsChecked\`); refresh bằng \`self.ListBox.Items.Refresh()\`.
- **Chống chết tool khi đổi XAML**: luôn \`if hasattr(self, 'txtLength'):\` trước khi truy cập control.

### 3.9. Modeless UI + \`ExternalEvent\` (bắt buộc khi \`Show()\`)

Revit chỉ cho sửa model trong context API; cửa sổ modeless chạy ngoài context → dùng handler:

\`\`\`python
from Autodesk.Revit.UI import IExternalEventHandler, ExternalEvent

class MyHandler(IExternalEventHandler):
    def __init__(self): self.doc_hash = None
    def Execute(self, app):                       # app = UIApplication
        uidoc = app.ActiveUIDocument; doc = uidoc.Document
        if doc.GetHashCode() != self.doc_hash:    # ★ chống thao tác chéo document
            print("⚠️ Đang mở file khác — bỏ qua."); return
        t = DB.Transaction(doc, "..."); t.Start(); ...; t.Commit()
    def GetName(self): return "SafeHandler"

handler = MyHandler(); handler.doc_hash = revit.doc.GetHashCode()
ext_event = ExternalEvent.Create(handler)   # tạo MỘT LẦN lúc mở form
ext_event.Raise()                           # gọi chạy mỗi lần cần (toggle workset, navigate…)
\`\`\`

- **Guard \`doc.GetHashCode()\`** bắt buộc cho tool modeless (3D WS).
- BOQ Pro / BOQ 3D Pro / Clash Check dùng cùng pattern — mỗi handler đảm nhiệm 1 việc (collect data / select / color / tạo schedule / navigate).

### 3.10. Báo lỗi & output
- \`print()\` in ra pyRevit output window.
- \`forms.alert("nội dung", title="...", exitscript=True)\` — thông báo + thoát tool.
- \`script.get_output()\` → \`output.print_html(...)\`, \`output.linkify(ids)\` tạo nút chọn element trong báo cáo (Z-SKIP dùng \`re.sub(r'>.*?</a>', '>🎯 CHỌN CÁC ĐỐI TƯỢNG LỖI</a>', raw_link)\` để rút gọn link).
- \`script.get_logger()\` → \`logger.warning(...)\` (Tagging Pro).

### 3.11. Tham số an toàn đa ngôn ngữ (không phụ thuộc tiếng Anh/Việt của Revit)

\`\`\`python
def _bip(name):
    """Lấy BuiltInParameter theo tên; None nếu phiên bản không có."""
    try:    return getattr(BuiltInParameter, name)
    except AttributeError: return None
\`\`\`
- Thử theo thứ tự: \`ParameterTypeId.RbsCtcServiceType\` (Revit 2022+) → danh sách tên BIP dự phòng → quét \`el.Parameters\` theo \`StorageType\`/tên chứa "service"/"type" → cuối cùng \`LookupParameter('Service Type')\` (chỉ Revit tiếng Anh).
- Với tham số \`StorageType.ElementId\` (VD Service Type máng cáp): hỗ trợ cả lưu dạng ElementId lẫn String (\`get_service_type_value\`).
- Với fitting không rõ tham số size: thử nhiều tên ("Nominal Diameter 1/2/3", "Main/Primary Diameter", "Branch/Secondary Diameter"…) — xem \`force_fitting_size\` (Branch 7/8, Vent Riser) và \`FittingSizeUtils.TrySetDiameter\`.

## 4. Thư viện dùng chung \`lib/plumbing_pro.py\`

> "Bộ não" của toàn bộ panel Plumbing. Các tool chỉ import class từ đây và gọi service — **không copy code hình học**. Được thêm vào \`sys.path\` nhờ pyRevit: \`from plumbing_pro import ...\`.

### 4.1. \`PipeSelectionFilter\` (ISelectionFilter)
Chỉ cho pick \`Pipe\`:
\`\`\`python
def AllowElement(self, elem): return isinstance(elem, Pipe)
def AllowReference(self, reference, position): return False
\`\`\`

### 4.2. \`PipeGeometryUtils\` — hằng số & hình học
| Thành phần | Ý nghĩa |
|---|---|
| \`Tolerance\` | 0.1 mm quy ra feet (dung sai hình học toàn dự án) |
| \`VerticalDot\` | \`0.99984769\` ≈ cos(1°): đường có \|Direction.Z\| > hằng số này coi là **đứng thẳng** |
| \`GetCenterline(pipe)\` | Trả \`pipe.Location.Curve\` (Line) nếu là \`LocationCurve\` |
| \`IsNearlyVertical(line)\` | Test ống đứng bằng \`VerticalDot\` |
| \`NormalizeXY(v)\` | Chiếu vector xuống mặt phẳng XY rồi chuẩn hoá (bỏ thành phần Z) |
| \`LiesOnSegment(line, p)\` | Point p có nằm trên đoạn line không (qua \`line.Project(p)\` và Parameter) |

### 4.3. \`ConnectorUtils\` — tiện ích connector
| Hàm | Công dụng / Cách dùng |
|---|---|
| \`GetManager(element)\` | Lấy \`ConnectorManager\` từ MEPCurve **hoặc** \`FamilyInstance.MEPModel\`; không có → raise Exception |
| \`IsPhysical(c)\` | Chỉ nhận \`ConnectorType.End / Curve / Physical\` (loại trừ Logical) |
| \`FreeConnectorNearest(element, target)\` | Tìm connector **chưa nối** gần điểm target nhất; không có → raise |
| \`ConnectorAtEnd(element, target)\` | Tìm connector chưa nối trùng vị trí đấu (dung sai 0.01); dùng khi ống đã dựng tới đúng đầu fitting |
| \`Connect(a, b, step_desc)\` | \`a.ConnectTo(b)\` bọc try/except, kèm mô tả bước để biết lỗi ở đâu |

### 4.4. \`PipeUtils\` — thông số ống
| Hàm | Công dụng |
|---|---|
| \`GetNominalDiameter(pipe)\` | \`pipe.Diameter\`, validate > 0 |
| \`SetNominalDiameter(pipe, value)\` | Set qua \`BuiltInParameter.RBS_PIPE_DIAMETER_PARAM\` (check IsReadOnly) |
| \`GetPipingSystemTypeId(pipe)\` | Ưu tiên \`pipe.MEPSystem.GetTypeId()\` → fallback BIP \`RBS_PIPING_SYSTEM_TYPE_PARAM\`; không ra → raise |
| \`GetLevelId(doc)\` | **Level thấp nhất** trong model (sort theo Elevation lấy phần tử đầu) |
| \`MoveEndPoint(doc, pipe, target, extend=True)\` | Đưa đầu ống gần target tới đúng target bằng cách gán lại \`Location.Curve\`; \`extend=False\` thì chặn thụt ngược làm đảo chiều ống |

### 4.5. \`FittingFinder\` / \`FittingSizeUtils\` — tìm & set size ngã ba
- \`FindJunctionFromPipeType(doc, pipe)\`: đọc \`pipe.PipeType.RoutingPreferenceManager\`, duyệt rule nhóm \`Junctions\`, ưu tiên family có chữ **"Wye"**.
- \`FindAllJunctions(doc, pipe)\`: kết hợp kết quả trên + quét toàn bộ \`FamilySymbol\` category \`OST_PipeFitting\` khớp keyword \`["Wye", "Y-", "Tee"]\`, dedupe theo Id.
- \`EnumerateParameters(fitting)\`: yield tham số của instance **và** của Type (fitting nhiều khi set size ở Type).
- \`TrySetDiameter(fitting, paramNames, keywords, value)\`: thử set theo tên chính xác trước, rồi theo keyword trong tên tham số; chỉ set tham số \`Double\`, không ReadOnly.
- \`SetPortDiameterByRadius(fitting, connector, diameter)\`: khi không biết tên tham số — tìm tham số Double **có giá trị hiện tại ≈ 2×Radius** của cổ nối (chênh ≤ 30%) rồi ghi đè.

### 4.6. \`AxisPipeValidator\` / \`AxisPipeService\` — nối ống nhánh vào TRỤC ĐỨNG
**Validator** (\`EnsureValidPair\`) kiểm tra: 2 ống tồn tại, không trùng nhau, ống thứ 2 phải đứng thẳng, cùng Piping System Type — sai cái nào raise Exception với thông báo tiếng Việt rõ ràng.

**Service** (\`CreateBranchConnection\`, \`OffsetMultiplier = 4.0\` = 4D):
1. Tìm đầu ống nhánh gần trục đứng → tính điểm bẻ co cách trục \`4D\`.
2. Thụt ống nhánh về điểm đó (\`Location.Curve = Line.CreateBound(...)\`).
3. Tạo đoạn ống chéo 45° từ điểm bẻ tới điểm đặt Wye trên trục đứng (\`ptWye\` — nằm cách điểm bẻ đúng \`reqDist\` theo Z, validate \`LiesOnSegment\`).
4. \`PlumbingUtils.BreakCurve\` cắt trục đứng tại Wye → 2 đoạn.
5. Đặt Family Wye tại ptWye: **xoay 3 trục** (\`RotateAroundAxis\`: lộn ngược nếu ống chéo đi xuống → quay quanh Z theo phương mặt bằng → nghiêng quanh trục vuông góc) rồi set diameter.
6. \`EnsureBranchDirection\` chỉnh cổ nhánh khớp hướng ống chéo; kéo từng đầu ống về đúng cổ (\`FindAngledPort\`, \`FindRunPorts\`) rồi \`ConnectorUtils.Connect\` từng cặp kèm mô tả bước.

### 4.7. \`BranchPipe1Validator\` / \`BranchPipe1Service\` — nối ống nhánh vào ỐNG CHÍNH NGANG
\`OffsetMultiplier = 3.5\` → phải chừa ~3.5D cho Wye + 2 lồi 45°.

\`CreateBranchConnection(doc, branchPipe, mainPipe, createFittings=True)\` — quy trình chuẩn "Wye 45°":
1. Tính **giao điểm mặt bằng** F giữa tâm 2 ống: \`PlanIntersection(p0, u, m0, v)\` (tích có hướng 2D, song song → raise "Song song trên mặt bằng").
2. Chặn trường hợp tâm nhánh **cắt xuyên** tâm chính (\`PlanDot\` 2 đầu trái dấu).
3. Điểm bẻ P3 trên ống nhánh, lùi \`L = D * OffsetMultiplier\` từ giao điểm.
4. \`FindOptimalPlanAngle(...)\`: **quét lưới 201 giá trị phi** (0→89°), chọn phương đấu tối ưu để góc vào Wye gần 45° nhất cả 2 phía (\`EvaluatePlanAngle\` + \`AcuteAngleDeg\`).
5. Thụt ống nhánh về P3, tạo ống 45° từ P3 tới điểm đấu Q3 trên ống chính.
6. Cắt ống chính tại Q3 (\`BreakCurve\`), dựng Wye tại Q3 với góc cổ nhánh \`thetaQ\`:
   - \`TrySetJunctionAngle\` (set tham số góc), xoay quanh Z theo phương chính, tilt quanh trục vuông góc, \`AlignBranchPort\` (2 pass, dung sai 6°).
7. \`SetJunctionDiameters\`: set nhánh trước (thử tên tham số → fallback theo Radius), rồi trục chính cho từng cổ run.
8. \`FindBranchPort\` / \`FindRunPorts\` / \`AssignRunPorts\` (dựa dấu \`BasisZ · runAxis\` để gán đúng cổ A/B) → kéo 3 ống vào 3 cổ → \`Connect\` từng cặp.
9. Cuối cùng chèn lồi 45° nối ống nhánh – ống 45° (\`NewElbowFitting\`).

> Nếu \`createFittings=False\` (SHIFT-click): chỉ dựng hình học, không sinh family — dùng để test.

### 4.8. Cách tool Plumbing gọi thư viện (mẫu chuẩn)

\`\`\`python
from plumbing_pro import (PipeSelectionFilter, BranchPipe1Validator,
                          BranchPipe1Service, PipeGeometryUtils, PipeUtils, ConnectorUtils)

with Transaction(doc, "Tên lệnh") as tx:
    tx.Start()
    opts = tx.GetFailureHandlingOptions()
    opts.SetFailuresPreprocessor(SuppressWarnings())   # luôn kèm bộ nuốt warning
    tx.SetFailuresPreprocessor(opts)

    BranchPipe1Validator.EnsureValidPair(doc, branch_pipe, main_pipe)  # validate trước
    BranchPipe1Service.CreateBranchConnection(doc, branch_pipe, main_pipe, True)
    tx.Commit()
\`\`\`
- Bọc toàn bộ bằng try: \`OperationCanceledException\` → \`sys.exit()\`; Exception khác → \`forms.alert("Lỗi kết nối:\\n\\n{}".format(ex), title="...")\`.

## 5. Panel **Dong's Tool**

### 5.1. Stack 1 — Xử lý ống gió & Sprinkler

#### \`Align Spk.pushbutton\` — Căn thẳng & kết nối cụm Ống đứng + Côn + Sprinkler
**Cách dùng:** quét chọn (hoặc PickObjects) vùng chứa ống đứng/côn giảm/sprinkler → chạy.
**Quy trình:**
1. Phân loại selection theo \`BuiltInCategory\` (\`OST_PipeCurves\` — *lưu ý fix: phải dùng OST_PipeCurves, không phải OST_Pipes*, \`OST_PipeFitting\`, \`OST_Sprinklers\`); chỉ lấy ống **thẳng đứng** (\`is_vertical\`: 2 đầu trùng X,Y).
2. Nhóm cụm: với mỗi ống đứng, lấy connector đầu **trên cùng** (sort theo Z), tìm côn + sprinkler gần nhất trong bán kính 5 ft (~1.5 m).
3. Trong 1 Transaction, từng cụm:
   - \`safe_disconnect_all(conn)\`: duyệt \`conn.AllRefs\`, \`DisconnectFrom\` toàn bộ (ngắt triệt để).
   - \`MoveElement\` côn về đúng (X,Y,Z) của đầu ống → Regenerate → \`MoveElement\` sprinkler về đỉnh côn (đồng tâm ống).
   - \`ConnectTo\` 2 cặp: ống↔côn, côn↔sprinkler.
4. Báo số cụm thành công bằng \`forms.alert\`.

**Lưu ý:** lỗi trong 1 cụm chỉ \`print\`, không dừng toàn bộ; sau mỗi bước di chuyển phải \`doc.Regenerate()\`.

#### \`Auto Merge Duct.pushbutton\` — Nối gộp ống gió qua Union (khử phụ kiện nối thẳng)
**Cách dùng:** hộp thoại WPF → bấm Run → quét chọn vùng ống gió + fitting → Finish.
**Quy trình \`process_merge(doc, union)\`:**
1. Union phải có đúng **2 cổ vật lý**; duyệt \`AllRefs\` tìm 2 ống gió đang cắm.
2. Chỉ merge khi 2 ống **thẳng hàng**: \`dir_A.CrossProduct(dir_B).GetLength() > 0.05\` → bỏ qua (tránh nối láo ống cong).
3. **Bảo vệ Taps**: đếm connector vật lý của từng ống (\`taps_A/B\`); ống nào có >2 cổ (đang cắm cổ trích) → giữ lại làm ống sống; cả 2 đều có taps → **không xoá ống nào** (bảo vệ dữ liệu).
4. Xoá union + ống B, kéo dài ống A (\`Location.Curve\` mới tới đầu B), Regenerate, tái cắm các thiết bị (\`refs_to_reconnect\`) vào đầu mới.
**Kỹ thuật:** mỗi union 1 Transaction (commit nếu OK, RollBack nếu \`process_merge\` trả False), bọc ngoài bằng \`TransactionGroup\` + \`Assimilate\`.
**⚠️ Fix lịch sử:** xác định union bằng \`MEPModel.PartType == PartType.Union\` — **không phải** \`PartType.UnionFitting\` (không tồn tại, từng gây lỗi). Cả hai file \`ui.xaml\` (hộp thoại) và \`alert.xaml\` (kết quả) dùng chung.

#### \`Auto Split Duct.pushbutton\` — Cắt ống gio dài quá giới hạn & chèn Union
**Cách dùng:** nhập chiều dài tối đa (mm, mặc định **1120**) → quét chọn ống → chạy.
**Quy trình (mỗi ống 1 transaction, có \`safety_counter > 500\` thoát vòng lặp khẩn cấp):**
1. Xác định đầu xa điểm đích, tính điểm cắt \`start + vec * max_len_ft\` (kèm \`curve.Project\`).
2. \`Mechanical.MechanicalUtils.BreakCurve\` — nếu lỗi thì **thử lại lùi thêm 2mm** (\`+ 2.0/304.8\`), vẫn lỗi thì bỏ qua vị trí này.
3. Sau cắt: \`get_open_connector\` (chưa nối, gần break point, dung sai 0.2) cho 2 đoạn → \`doc.Create.NewUnionFitting(connA, connB)\`.
4. Chọn đoạn tiếp tục (\`Evaluate(0.5, True)\` — đo trung điểm nào gần đích hơn).
**Kỹ thuật:** TransactionGroup chống lag cuối tool; \`doc.Regenerate()\` đầu mỗi vòng lặp.

### 5.2. Stack 2 — BOQ & Clash Check

#### \`BOQ Pro.pushbutton\` — Dashboard lập bảng khối lượng MEP (WinForms)
- \`__persistentengine__ = True\` (giữ engine sống giữa các lần chạy).
- **Kiến trúc 4 lớp ExternalEvent** (form WinForms modeless):
  | Handler | Nhiệm vụ |
  |---|---|
  | \`EpDataHandler\` | Quét model, thu thập dữ liệu phần tử MEP: Workset, Level, System Type, Category, toạ độ Z, độ nghiêng; **cache** vào \`cached_data\` |
  | \`SelectionHandler\` | Set selection trong Revit khi user bấm 1 dòng |
  | \`ColorOverrideHandler\` | Ép màu phần tử theo lọc hiện tại (view override) |
  | \`ScheduleCreateHandler\` | Tạo Schedule/Qty trong Revit theo bộ lọc |
- \`BOQDashboardForm(Form)\` + \`InitLayout()\` dựng UI WinForms thuần (ListBox lọc, DataGridView, preset save/load, progress…).
- **Xử lý System Type đa dạng** (\`internal_get_system_type_name\`): với đám thiết bị điện (ElectricalEquipment/Fixtures, Lighting, FireAlarm, Security, Data, Communication, Telephone, NurseCall) → lấy \`RBS_ELEC_CIRCUIT_NUMBER\` hoặc \`RBS_ELEC_PANEL_NAME\`, không có trả "Noname".
- Lấy Z: ưu tiên Location → fallback \`get_BoundingBox(None).Min.Z\` (thiết bị bám trần/tường không có Location).
- Xuất Excel (SaveFileDialog), tạo Schedule, ép màu + reset màu, preset lưu/đọc.

#### \`BOQ 3D Pro.pushbutton\` — Phiên bản WPF + hồ sơ (profile)
- Cùng 4 handler như BOQ Pro nhưng form là **WPF** (\`BOQDashboardWPF(forms.WPFWindow)\`), thêm:
  - \`scope_3d_changed\`: lọc theo vùng 3D đang chọn (Section Box / vùng nhìn).
  - **Quản lý hồ sơ lọc** (\`_profiles_dir\`, \`_read_profile\`, \`_write_profile\`, \`_safe_filename\`, \`_current_filter_snapshot\`, \`_apply_filter_snapshot\`) — lưu JSON, load/save/save-as/delete, đổi thư mục profile.
  - \`_get_config_path\` cấu hình riêng theo máy.
- \`dgBOQ_AutoGeneratingColumn\`: tuỳ biến cột DataGrid.

#### \`Clash Check.pushbutton\` — Phát hiện va chạm MEP (WinForms modeless)
- **Phạm vi category**: \`MEP_CATEGORIES\` (20 nhóm MEP: Duct/Pipe/Flex/Accessory/Terminal/Sprinkler/CableTray/Conduit/Điện/Thiết bị) vs \`AS_CATEGORIES\` (10 nhóm kiến trúc/kết cấu), có \`MEP_ORDER\`/\`AS_ORDER\` sắp xếp.
- \`ClashNavigationHandler\` (ExternalEvent): \`Selection.SetElementIds\` + \`ShowElements\` — nhảy tới điểm va chạm khi click dòng.
- \`extract_solids(element)\`: duyệt \`get_Geometry\` đệ quy (\`_extract_solids_recursive\`) lấy Solid, \`ComputeReferences\` để có Reference cho navigate.
- UI 3 tab: **Input** (SetupInputTab: chọn category A/B, link model \`LoadRevitLinks\`, \`ToggleLinkMode\`), **Output** (danh sách va chạm, \`OnClashRowFocused\` → navigate, \`OnCopyID\`), **Report** (thống kê, xuất **Excel/CSV** \`OnExportExcelCSV\`, xuất **BCF** \`OnExportBCF\`).
- Đánh giá trạng thái từng clash: Active / Reviewed / Approved (\`UpdateSelectedStatus\`).
- Cache: \`InitCache\` / \`SaveCache\` (lưu kết quả để mở lại không phải quét).
- UI WinForms bo góc bằng GDI+ \`set_rounded_region\` (GraphicsPath AddArc, nhớ \`path.Dispose()\`).
- Filter nhanh theo từ khoá: \`BtnFilter_MEP/Pipe/Duct/Elec/Device/AS/Clear\` → \`ApplyFilter(listbox, keyword_list)\`.

### 5.3. Stack 3 — Tô màu

#### \`3D WS.pushbutton\` — Bật/tắt Workset trong 3D View (modeless)
- Chỉ chạy trên **View3D** không có View Template (\`view.ViewTemplateId == InvalidElementId\`) — có template thì khoá \`WorksetList.IsEnabled\`.
- \`FilteredWorksetCollector(doc).OfKind(WorksetKind.UserWorkset)\` → list \`WorksetItem\` (đọc trạng thái \`view.GetWorksetVisibility(ws.Id)\`; \`UseGlobalSetting\` → theo \`ws.IsVisibleByDefault\`).
- Gạt nút → \`handler.ws_id_int = int(sender.Tag)\`; \`ext_event.Raise()\` → trong \`Execute\`: \`view.SetWorksetVisibility(WorksetId, WorksetVisibility.Visible/Hidden)\` + \`uidoc.RefreshActiveView()\`.
- **Kỹ thuật đáng học**: guard \`doc.GetHashCode() == self.doc_hash\` để chặn thao tác chéo document; biến toàn cục \`_workset_modeless_window_\` giữ cửa sổ không bị GC.

#### \`Color Element.pushbutton\` — Tô màu selection theo 50+ màu
- Từ điển \`colors\` gồm ~55 màu đặt tên \`"01 Red"…\` + mục \`"00 Reset (mac dinh)"\` = \`None\`.
- Chọn màu (\`forms.SelectFromList\`) + chọn kiểu áp (\`OPTION_PROJ_LINE\`, \`OPTION_SURF_FG\`, \`OPTION_SURF_BG\`, \`OPTION_CUT_LINE\`, \`OPTION_CUT_FG\`, \`OPTION_CUT_BG\`).
- Lấy Solid Fill Pattern: duyệt \`FillPatternElement\`, \`fp.GetFillPattern().IsSolidFill\`.
- Áp dụng qua \`OverrideGraphicSettings()\`:
  - đường bao: \`SetProjectionLineColor(color)\` / \`SetCutLineColor(color)\`
  - mặt: \`SetSurfaceForegroundPatternColor\` + \`SetSurfaceForegroundPatternVisible(True)\` + \`SetSurfaceForegroundPatternId(solid_pat.Id)\` (tương tự Background, Cut)
  - gọi \`view.SetElementOverrides(eid, ogs)\` trong \`revit.Transaction\`.
- Reset = \`view.SetElementOverrides(eid, OverrideGraphicSettings())\` (trống → về mặc định).
- Đếm success/failed, in lỗi từng Id.

#### \`Color Systems.pushbutton\` — Ép màu theo Hệ thống MEP + tự tạo Legend
- Gom hệ thống theo 3 nhóm category: \`DUCT_CATS\` (6 cat), \`PIPE_CATS\` (7 cat), \`ELEC_CATS\` (4 cat).
- \`SystemItem\`: tên + màu random \`DrawingColor.FromArgb(60–220, …)\` + checkbox + nút màu (ColorDialog).
- Preset JSON ở \`%TEMP%\`: \`DBIM_MEPColorPresets_Master.json\`; import/export/save/delete preset.
- Khi chạy: tạo **View Filter** tên \`DBIM_<tên hệ thống>\`, gán lên view mục tiêu, override màu bằng \`SetElementOverrides\`.
- Nếu view có View Template → cảnh báo (override có thể bị template ghi đè).
- Tùy chọn tạo **Drafting View Legend**: dựng bảng bằng \`FilledRegion.Create\` + \`CurveLoop\` + \`TextNote.Create\` (TextNoteOptions, HorizontalTextAlignment.Left), viền bằng DetailLine — mỗi hệ 1 ô màu + tên \`DBIM_…\`.

### 5.4. Stack 4 — Dim, Title Block, Tag

#### \`Dim Pro.pushbutton\` — Tự động dimension nhánh (⚠️ code base64)
- Script.py **mã hoá base64**: \`exec(compile(base64.b64decode(_c), '<string>', 'exec'), globals())\`.
- ⚠️ Lưu ý: muốn sửa logic phải **decode** (giải mã) rồi chỉnh, không sửa trực tiếp file.
- Nội dung (đã decode): \`get_conns\`, \`get_conn_area\` (Round = πR², Rect/Oval = W×H), \`get_part_type\`, \`get_location_point\`, \`is_connected_to_selection\`; trích ứng cặn tham chiếu từ Geometry (\`Options: ComputeReferences=True, IncludeNonVisibleObjects=True, View\`) lọc mặt phẳng vuông góc hướng dim (\`abs(normal.DotProduct(dim_dir)) > 0.999\`); lọc điểm theo Z (chồng dim dùng Z cao nhất); gom thành \`ReferenceArray\` (loại trùng theo khoảng cách project); tạo \`doc.Create.NewDimension(view, dim_line, ref_array)\`.
- **Chạy liên tục** \`auto_dim_continuous()\`: hỗ trợ quét chọn trước → \`process_branch\`; vòng lặp PickObjects đến khi ESC (\`OperationCanceledException: break\`); nhấn SPACE = thực hiện dim.

#### \`List Title Block.pushbutton\` — Liệt kê Title Block trên các Sheet đã chọn
1. Lấy selection lọc \`ViewSheet\` (set Id cho O(1)); nếu không có sheet → alert + thoát (\`exitscript=True\`).
2. 1 lần duy nhất quét \`OST_TitleBlocks\` + \`WhereElementIsNotElementType()\`, lọc \`tb.OwnerViewId ∈ selected_sheet_ids\`.
3. \`TitleBlockItem\` display: \`"[{SheetNumber}] {Family} : {Type}"\`, property \`IsSelected\` bind được WPF.
4. \`TBSelectionWindow\` (WPF): Select All/None → Apply → \`revit.get_selection().set_to(selected_ids)\` (đổi selection trong Revit).
- **Kỹ thuật:** sắp xếp \`tb_list.sort(key=lambda x: x.DisplayName)\`; \`Items.Refresh()\` sau khi đổi checked.

#### \`Tagging Pro.pushbutton\` — Tag hàng loạt Pipe/Duct/Cable Tray (Plan View)
- Chỉ chạy ở **ViewPlan**; load sẵn loại tag theo 3 category (\`OST_PipeTags\`, \`OST_DuctTags\`, \`OST_CableTrayTags\`), tên hiển thị \`"{Family} : {SYMBOL_NAME_PARAM}"\`, map \`<None>\` = None.
- Cấu hình UI: kích thước tag, \`USE_LEADER\`, \`MAX_TRY\`, \`BASE_OFFSET\`, \`ALIGN_TAGS\`, \`SORT_MODE\` (TOP/BOTTOM…), \`safe_float\` (chấp nhận dấu phẩy thập phân).
- Đặt tag: \`IndependentTag.Create(doc, view.Id, Reference(el), USE_LEADER, TagMode.TM_ADDBY_CATEGORY, TagOrientation.Horizontal, final_point)\` → \`tag.ChangeTypeId(...)\` theo category.
- **Chống chồng tag**: nếu không leader, thử offset vuông góc 2 phía (\`perp = XYZ(-direction.Y, direction.X, 0)\`), mỗi lượt +2.0 ft, kiểm \`too_close(candidate)\`; xoay tag đầu theo góc ống (\`atan2\`, chuẩn hoá về ±90°, trục xoay đứng qua điểm).
- Cuối cùng (nếu \`ALIGN_TAGS\`): kéo \`TagHeadPosition\` về trung bình vị trí X (hoặc Y) của tất cả tag — tag thẳng hàng.

### 5.5. Stack 5 — Align View, Connect Spk, Z-SKIP

#### \`Align View.pushbutton\` — Căn vị trí View trên nhiều Sheet theo 1 Sheet chuẩn
- **Engine** \`AlignEngine\`:
  - \`all_viewports_by_sheet()\`: 1 collector duy nhất cho toàn bộ Viewport (nhanh hơn gọi \`GetAllViewports\` từng sheet).
  - 2 chế độ khớp: \`MODE_INDEX\` (đối theo **vị trí** trên sheet: sort \`(-center.Y, center.X)\` = từ trên xuống, trái sang phải) và \`MODE_VIEW_NAME\` (đối theo tên view).
  - \`_snap(vp)\`: căn toạ độ viewport theo sheet chuẩn; \`_almost\` so gần bằng; cache center 1 lần (\`centers\` dict) tránh gọi \`GetBoxCenter\` nhiều lần gây regen.
  - Tùy chọn copy: Rotation / View Type / View Name Label / Precise Label.
- **UI**: \`AlignViewsWindow\` — 2 ListBox (sheet chuẩn / sheet đích), search filter, chọn nhiều, chọn mode; chạy xong hiện \`AlignResultWindow\` báo số sheet đã canh.
- \`SheetItem\` hiển thị \`"Number — Name"\` + số view (\`GetAllViewports\`).
- Dùng \`SuppressWarnings\` để chặn warning khi dịch viewport.

#### \`Connect Spk.pushbutton\` — Kết nối Sprinkler với ống (3 option, có nhớ cài đặt)
- Cài đặt **lưu qua biến môi trường** (\`os.environ\`): \`SPK_CONNECT_SIZE\`, \`SPK_CONNECT_OPTION\`, \`SPK_CONNECT_RADIUS\` (mặc định 2000), \`SPK_CONNECT_RISER\` (300) — mở lại lần sau giữ nguyên.
- 3 chế độ: \`Option1\` Down Connection (tạo ống rơi xuống), \`Option2\` (kéo dài ống tới vị trí, có \`OPTION2_EXTEND_TOLERANCE_FT\` = 2 ft, \`OPTION2_MIN_PIPE_SEGMENT_FT\`), \`Option3\`.
- Hằng số chung: \`END_TOLERANCE_FT = 50/304.8\`, \`Z_TOLERANCE_FT = 0.05\`, \`CONNECTOR_TOLERANCE_FT = 0.1\`.
- \`flat_project(pipe, pt)\`: chiếu điểm lên đường tâm ống **chỉ XY** (clamp \`t ∈ [0, len]\` cho Connect Spk, không clamp cho Pro).
- Bộ lọc \`SpkPipeFilter\` cho phép chọn cả Pipe lẫn Sprinkler; dùng \`SubTransaction\` khi xử lý từng vị trí.
- UI WPF \`SpkWindow\` với cờ \`IsRunClicked\`; mọi truy cập control đều bọc \`hasattr\`.

#### \`Connect Spk Pro.pushbutton\` — Bản nâng cấp của Connect Spk
- Cùng bộ hằng số/option; khác biệt: \`flat_project\` **không clamp** (chiếu ra ngoài đoạn — cho phép đấu vào đầu kéo dài), UI lớn hơn, thuật toán chọn ống/điểm đấu thông minh hơn.
- Chọn bản nào: bản thường cho quy trình chuẩn; **Pro khi cần xử lý layout phức tạp, ống lệch vị trí**.

#### \`Z Elevation Level.pushbutton\` (Z-SKIP) — Dời hàng loạt phần tử về Level khác
- **Map category → cặp (Level param, Offset param)** \`CATEGORY_PARAM_MAP\`:
  - Walls: \`WALL_BASE_CONSTRAINT\`/\`WALL_BASE_OFFSET\`; Floors/Ceilings: \`LEVEL_PARAM\`/\`*_HEIGHTABOVELEVEL_PARAM\`; Roofs; Columns: \`FAMILY_BASE_LEVEL_*\`; Duct/Pipe/Conduit/CableTray/Flex: \`RBS_START_LEVEL_PARAM\`/\`RBS_OFFSET_PARAM\`; Structural Framing: \`INSTANCE_REFERENCE_LEVEL_PARAM\` (không offset).
  - Fallback chung: \`GENERIC_LEVEL_FALLBACK\` (FAMILY_LEVEL_PARAM → …) và \`GENERIC_OFFSET_FALLBACK\` (INSTANCE_FREE_HOST_OFFSET_PARAM → …).
- UI \`ZLevelPickerWindow\` (XAML riêng) — chọn Level đích (sort theo Elevation giảm dần), hiện số phần tử sẽ dời.
- \`process_element(el, target_level_id, elevation)\`: gán level param + tính lại offset giữ đúng Z hiện tại (kết quả: \`success\` / \`warn\` / \`error\` / \`info\`).
- **Báo cáo HTML dashboard** qua \`output.print_html\` (CSS nhúng: thẻ thống kê success/warn/error/skip, nút linkify chọn phần tử lỗi, footer copyright).

### 5.6. Stack 6 — Chào hỏi, Conduit, Excel

#### \`Chao Dong.pushbutton\` — Cửa sổ chào hỏi (WPF)
Bản modal (\`ShowDialog\`) của \`startup.py\`: hiệu ứng fade-in, nút "Chào lại" đổi text/icon thành mode VIP, ESC đóng. Demo về **custom XAML + animation + custom title bar**.

#### \`Conduit Tray.pushbutton\` — Vẽ tuyến Conduit bám theo tuyến Máng cáp
1. Quét chọn máng + fitting (\`OST_CableTray\` + \`OST_CableTrayFitting\`).
2. Lấy \`ConduitType\` đầu tiên trong model (cảnh báo nếu chưa có); level = level máng đầu tiên.
3. Với từng máng thẳng: ống luồn chạy **trên đỉnh máng** \`z + tray_height/2\` (đọc \`RBS_CABLETRAY_HEIGHT_PARAM\`), \`Electrical.Conduit.Create\`; lưu map \`tray_id → conduit\`.
4. Với fitting nối đúng 2 máng: tìm 2 conduit tương ứng qua map, nối cặp connector gần nhất bằng \`doc.Create.NewElbowFitting\` (tee/cross: chỗ để mở rộng).
- Giao dịch 1 lần cho cả tuyến, lỗi → \`t.RollBack()\` + in lỗi.

#### \`Excel Synch.pushbutton\` — Sửa tham số MEP qua bảng (đồng bộ Excel)
- **Nguồn dữ liệu**: \`DataTable\` (System.Data) hiển thị trên \`DataGrid\`.
- Dropdown category: quét \`doc.Settings.Categories\` lọc \`CategoryType.Model\`, **bỏ** category import/link (.dwg/.dxf/.rvt), chỉ giữ category có phần tử (\`GetElementCount() > 0\`).
- Cột cố định: \`UniqueId\` (ẩn/readonly), FamilyName, TypeName, Level, Workset, \`SystemAbbreviation\` — lấy qua chuỗi fallback \`RBS_SYSTEM_ABBREVIATION_PARAM\` → \`RBS_DUCT_SYSTEM_ABBREVIATION_PARAM\` → \`RBS_PIPE_SYSTEM_ABBREVIATION_PARAM\` → \`LookupParameter("System Abbreviation")\` → "N/A".
- **Ctrl+V paste khối** vào grid: parse clipboard theo \`\\r\\n\` và \`\\t\`, ghi vào từng ô (bỏ cột ReadOnly); \`AutoGeneratingColumn\` set ReadOnly cho cột hệ thống.
- **Export CSV** (SaveFileDialog) / **Import CSV** (OpenFileDialog + \`TextFieldParser\` của \`Microsoft.VisualBasic.FileIO\` — parse chuẩn CSV có dấu ngoặc kép).
- **Save (đồng bộ ngược về Revit)**: duyệt từng row, \`doc.GetElement(uniq_id)\`; với mỗi tham số động: set theo \`StorageType\` (String → \`p.Set(str)\`; Integer → \`int()\` fallback \`SetValueString\`; Double → \`SetValueString\` fallback \`float()\`) trong 1 Transaction; TaskDialog báo số cấu kiện thành công.

### 5.7. Stack 7 — Nối ống nước & Sprinkler Pro

#### \`Connect Brach.pushbutton\` — Nối 1 ống nhánh vào ống chính (vượt qua khoảng hở)
1. PickObject lần lượt: **Ống nhánh** → **Ống chính** (lọc \`OST_PipeCurves\`).
2. \`get_2d_intersection\`: giao điểm **mặt bằng** của 2 đường tâm (cramer/cross, song song → cảnh báo dừng).
3. \`get_z_elevation(curve, xy)\`: nội suy Z tại điểm XY — ống có **độ dốc** vẫn chính xác.
4. Tạo ống đứng nối 2 điểm (\`Pipe.Create\`), **kế thừa** System Type / Pipe Type / Level / Đường kính từ ống nhánh.
5. \`PlumbingUtils.BreakCurve\` cắt nhánh tại điểm giao → chèn **Tee** (\`NewTeeFitting\` 3 connector gần điểm giao); lỗi → fallback **Elbow**.
- ESC → bỏ qua êm; lỗi → rollback nếu transaction đã start + TaskDialog.

#### \`Connect to Main.pushbutton\` — Bản hàng loạt của Connect Brach
- Chọn **nhiều ống nhánh** (quét chuột) + 1 ống chính.
- **1 Transaction duy nhất** cho toàn bộ (tăng tốc, tránh rác Undo).
- Vòng lặp từng nhánh, mỗi ống bọc try/except riêng: trùng ống chính → skip; không giao → \`count_fail\`; sau \`Pipe.Create\` + \`BreakCurve\` **bắt buộc \`doc.Regenerate()\`** trước khi bắt connector.
- Fallback 3 tầng: Tee → Elbow → bỏ qua; cuối cùng TaskDialog báo \`Thành công / Thất bại\`.

#### \`Connect Spk Pro.pushbutton\`
Xem 5.5.

### 5.8. \`Sheet & View Manager.pushbutton\` — Trạm quản lý Sheet/View (WPF ~1400 dòng)

**Kiến trúc Service** (mỗi nghiệp vụ 1 class, method tĩnh):
| Service | Chức năng chính |
|---|---|
| \`SheetService\` | \`get_title_blocks\`, \`get_existing_numbers\`, \`plan_sequence_numbers(count, prefix, start, digits)\`, \`find_conflicts(numbers)\`, \`create_from_sequence\` (tạo sheet theo dãy số), \`create_from_csv(rows, tb_id)\`, \`_apply_sheet_number\` (gán number/name, check trùng) |
| \`ViewService\` | \`get_levels\`, \`get_plan_types\`, \`get_all_views\`, \`get_placed_view_map\` (view đã đặt lên sheet nào), \`create_plans(levels, view_type_id)\`, \`duplicate_views(views, option, count)\` (duplicate with detailing/dependent) |
| \`RenameService\` | \`find_replace\` (hỗ trợ **regex**), \`add_prefix_suffix\`, \`sequential\` (đổi tên dãy \`base_001\`), \`from_csv\` (map tên theo file CSV) |
| \`PlacementService\` | \`place_one_per_sheet\` (mỗi view lên 1 sheet), \`place_rows(sheet, views, start_x_mm, start_y_mm, …)\` (đặt dạng lưới theo toạ độ mm) |

**Window** \`SheetViewManagerWindow\`:
- Đăng ký sự kiện an toàn: \`_safe_wire(ctrl, event, handler)\` — control không tồn tại vẫn không crash.
- **Debounce** tìm kiếm (\`_setup_debounce\`, \`_debounce\`, DispatcherTimer) — không filter lại mỗi phím gõ.
- Tách UI khỏi lệnh: \`_unwrap_all\`/\`_release\` — mọi hành động chạy trong \`_run(action)\`.
- 5 khu vực: quản lý **Sheet** (tạo dãy / CSV / check trùng số qua \`ConflictDialog\`), **View** (tạo plan theo level, duplicate), **Rename** (4 chiến lược), **Placement** (đặt view lên sheet), filter/search từng danh sách.
- \`_eid_int\` + \`SuppressWarnings\` dùng xuyên suốt.

## 6. Panel **Model Tool**

> 12 nút bẻ co chia 5 stack + 1 stack Utility. Toàn bộ dùng chung **thuật toán "universal bend"** — hỗ trợ đồng thời **Pipe / Duct / Cable Tray**.

### 6.1. Nhóm bẻ co 90°: \`Up Elbow\` / \`Down Elbow\` / \`Left Elbow\` / \`Right Elbow\`
Cấu trúc chung (đọc 1 nút là hiểu cả 4, chỉ khác vector hướng):
- \`PickObject(ObjectType.PointOnElement, ...)\` — user **click gần đầu nào** thì bẻ ở đầu đó (\`click_pt.GlobalPoint\`, so khoảng cách tới 2 đầu).
- \`get_segment_length(src)\`: chiều dài đoạn mới — **CableTray = 3 × Width** (đủ chỗ gắn fitting), Pipe/Duct = **500 mm**.
- Xoay chặn: đoạn đang đứng thẳng (\`abs(direction.Z) > 0.99\`) không bẻ lên 90° được.
- **Trick quan trọng với Duct/CableTray**: tạo đoạn NGANG cùng hướng dòng chảy (Revit định hướng profile đúng, không bị lật 90°), rồi **xoay đoạn đó lên đứng** quanh trục vuông góc:
  \`\`\`python
  axis_vec = flat_dir.CrossProduct(XYZ.BasisZ).Normalize()
  ElementTransformUtils.RotateElement(doc, new_el.Id, Line.CreateBound(start_pt, start_pt + axis_vec), math.pi/2.0)
  \`\`\`
  Pipe thì dựng thẳng đứng trực tiếp.
- Đoạn mới được **kế thừa đồng bộ**: System/Service Type + kích thước (Ø / W / H) qua danh sách BIP dự phòng (\`RBS_PIPE_DIAMETER_PARAM\`, \`RBS_CURVE_DIAMETER_PARAM\`, \`RBS_CURVE_WIDTH/HEIGHT_PARAM\`, \`RBS_CABLETRAY_WIDTH/HEIGHT_PARAM\`).
- \`find_conn_at(el, pt)\` (dung sai 0.1 ft) tìm cặp connector 2 đầu → \`doc.Create.NewElbowFitting(c_old, c_new)\`.
- Chạy trong \`with revit.Transaction("Universal Up 90"):...; lỗi từng phần tử chỉ \`print\`.

### 6.2. Nhóm bẻ co 45°: \`45 Up/Down/Left/Right Elbow\`
- Giống nhóm 90° nhưng: xoay đoạn mới **45°** so với phương cũ (giữ độ dốc đang có — tooltip bundle: "giữ độ dốc"), đoạn mới dài 500mm/3×Width.
- Dùng cho: né cản, dẫn ống chéo qua dầm, giữ slope ống thoát nước khi đổi hướng.

### 6.3. Utility stack

#### \`45 degree elbow.pushbutton\` — Biến đổi 1 co 90° thành 2 co 45° (+ đoạn nối)
1. Quét chọn nhiều co (\`OST_PipeFitting\` + \`OST_DuctFitting\`), nhập khoảng lùi (mm, mặc định 300).
2. Tìm 2 ống chủ (\`host_data\`) qua \`conn.AllRefs\` (\`isinstance(ref_conn.Owner, MEPCurve)\` — Pipe lẫn Duct chung 1 lối).
3. Xoá co cũ → thu ngắn 2 ống chủ về điểm mới cách tâm co \`offset\` → tạo **đoạn nối trung gian** (Pipe.Create hoặc Duct.Create — Duct phải đồng bộ Ø hoặc W+H theo round/rect) → chèn **2 lồi 45°** tại 2 đầu.
- Xác định Duct: lấy \`RBS_DUCT_SYSTEM_TYPE_PARAM\`; Pipe: \`RBS_PIPING_SYSTEM_TYPE_PARAM\`.

#### \`Connect to.pushbutton\` — Nối 2 cấu kiện (cặp connector gần nhau nhất)
- Hỗ trợ **quét chọn sẵn 2 phần tử** trước khi bấm (\`GetElementIds().Count == 2\`), không thì PickObject 2 lần.
- Quét connector cả 2 (MEPCurve hoặc FamilyInstance), bỏ Logical, tìm cặp \`c1.Origin.DistanceTo(c2.Origin)\` nhỏ nhất → \`ConnectTo\` trong transaction; lỗi thường do lệch size / khác system / cổ đã bận.

#### \`Disconnect.pushbutton\` — Ngắt 2 cấu kiện
- Cùng luồng chọn như Connect to; duyệt connector el1 đang \`IsConnected\`, trong \`AllRefs\` tìm connector thuộc el2 (không Logical) → \`DisconnectFrom\`; báo số điểm đã ngắt.

### 6.4. Model Tool.panel\\bundle.yaml
\`\`\`yaml
title: Model Tool
layout: [Up Down, Left Right, 45 Up Down, 45 Left Right, Utility]
\`\`\`
→ panel xếp 5 stack theo layout khai báo (không cần prefix số).

## 7. Panel **Plumbing**

> Tất cả dùng chung \`plumbing_pro\` (xem mục 4). Các Branch khác nhau ở **biến thể hình học** (khoảng lùi, số lồi 45, đường ống trung gian).

### 7.1. \`Drainage.stack\`
| Tool | Mô tả |
|---|---|
| \`AxisPipe\` | Nối ống nhánh ngang vào **TRỤC ĐỨNG** (validator: ống 2 phải đứng, cùng system) — \`AxisPipeService.CreateBranchConnection\`, lùi 4D, tạo ống chéo 45° + Wye. |
| \`BranchPipe1\` | Nối ống nhánh vào **ống chính NGANG** — thuật toán Wye 45° chuẩn (mục 4.7). Giữ **Shift-click** → chế độ Test chỉ dựng hình học. |
| \`Connect Fixture\` | Nối **thiết bị vệ sinh** xuống ống chính: chọn connector đáy thiết bị (\`Domain == DomainPiping\`, BasisZ.Z thấp nhất, chưa nối); đường kính = \`Radius*2\` của connector; độ dốc cố định **2%**; kiểm tra khoảng trống ≥ \`3.5D + 2D\` (không đủ → báo số mm tối thiểu); kiểm tra ống chính phải **thấp hơn** thiết bị (nước chảy trọng lực); dựng ống đứng + ống ngang dốc → gọi \`BranchPipe1Service.CreateBranchConnection\` (Wye 45°) → cuối chèn co 90° đáy thiết bị. |

### 7.2. \`Drainage2.stack\` — Branch 2 / 3 / 4
Ba biến thể nối ống nhánh → ống chính cho hệ thoát nước, cùng khung code (SuppressWarnings, \`xy()\`, \`execute()\`), khác nhau ở khoảng lùi/số đoạn trung gian và cách xử lý fitting. Dùng để lựa chọn theo thực tế thi công (khoảng thông thoáng khác nhau).

### 7.3. \`Branch 5\` / \`Branch 7\` / \`Branch 8\` (nút lẻ)
- **Branch 5 — "5xD & 2xD Offset"**: nhánh trên cao, chính bên dưới. Quy trình: tính giao điểm mặt bằng P_hit + độ dốc hướng hạ lưu (\`S_m\`, \`sigma\`) → lùi \`1.5D\` tạo khoảng hở trước điểm hit → dựng chuỗi 4 đoạn: ống nhánh (thụt) → **mid_pipe** → **pipe_drop** (đoạn hạ) → **pipe_horiz** → **pipe_conn** → cắt ống chính tại P_hit → \`BranchPipe1Service.CreateJunction\` (Wye 45°, góc 45° cứng) + gán cổ → chèn **4 lồi 45°** (mỗi khớp 1 lồi, bọc try/except pass).
- **Branch 7 — "2xD Offset"**: như Branch 5 nhưng khoảng lùi nhỏ hơn (2D), thêm hàm \`force_fitting_size\` ép tham số size fitting theo nhiều tên dự phòng ("Nominal Radius 1/2/3", "Nominal Diameter 1/2/3", "Main/Branch Radius/Diameter"…) — set cả instance lẫn Type.
- **Branch 8**: biến thể tương tự Branch 7 với cấu hình khoảng lùi khác.
- **Lưu ý dùng:** chọn \`5xD\` khi không gian thoáng (đủ bẻ 2 lồi 45° + khoảng hở), \`2xD\` khi chật. Quy trình luôn: **validate bằng \`PipeUtils.GetNominalDiameter\` / \`GetPipingSystemTypeId\` trước, dựng sau**.

### 7.4. \`Vent Riser.pushbutton\` — Nối nhánh ống thông khí lên trục đứng
Các hàm đặc trưng (bên trên khung Branch chung):
- \`get_vertical_ports(fitting)\`: tìm cổ trục đứng của fitting theo hướng connector.
- \`create_vertical_wye(...)\`: dựng Wye 45° trên trục đứng, tạo **2 đoạn đứng** cho 2 phía + gán hướng ra ngoài (\`get_outward_dir\`).
- \`safe_connect(pipe, fitting_port, backup_pt, doc_ref)\`: kéo đầu ống về cổ fitting rồi nối — nếu ống kẹt/biến mất (\`min_d >= 3.0\`) raise kèm toạ độ để tra lỗi.
- \`assign_vertical_runs\`: phân đoạn cho 2 ống theo phía; \`is_elbow_connection\` phát hiện nối qua lồi.
- \`force_fitting_size\` như Branch 7/8.

### 7.5. Quy trình thao tác chuẩn của người dùng (tất cả tool Plumbing)
1. Bấm nút tool → tool hỏi **Ống nhánh** trước, **Ống chính** sau (prompt nhắc rõ + "developed by Dong Tran Ba").
2. Tool validate (cùng system, hình học hợp lệ) — sai ngay lập tức hiện \`forms.alert\` với nguyên nhân.
3. Tool dựng hình học + sinh fitting trong 1 transaction đã gắn \`SuppressWarnings\`.
4. ESC bất cứ lúc nào chọn đối tượng = thoát êm (không văng lỗi).

## 8. Quy trình phát triển tool mới

Dựa trên những gì các tool hiện có đang làm, khi thêm tool mới nên theo đúng **khung 6 bước**:

**Bước 1 — Khởi tạo bundle**
\`\`\`
Dong Tran Ba.tab\\<Panel>.panel\\<N.stack>\\<Tên Tool>.pushbutton\\
    ├── script.py     (bắt buộc)
    ├── icon.png      (32x32, khuyến nghị)
    ├── ui.xaml       (nếu có giao diện)
    └── bundle.yaml   (title/tooltip/author; context: zero-doc nếu không cần model)
\`\`\`

**Bước 2 — Khung script chuẩn**
\`\`\`python
# -*- coding: utf-8 -*-
import clr
clr.AddReference('RevitAPI'); clr.AddReference('RevitAPIUI')

from Autodesk.Revit.DB import *
from Autodesk.Revit.UI.Selection import ObjectType, ISelectionFilter
from Autodesk.Revit.Exceptions import OperationCanceledException
from pyrevit import revit, forms, script

doc, uidoc = revit.doc, revit.uidoc

# 1) FILTERS (ISelectionFilter theo category)
# 2) HELPER (connector, hình học, đơn vị)
# 3) UI (forms.WPFWindow nếu cần; modal → ShowDialog; cờ is_run)
# 4) CORE (thuật toán thuần, tách khỏi UI)
# 5) MAIN (try/except OperationCanceledException → sys.exit(); Exception → forms.alert)
if __name__ == '__main__':
    main()
\`\`\`

**Bước 3 — Viết logic MEP theo đúng quy tắc**
- Lấy thông số trước (\`GetNominalDiameter\`, system type, level) → validate → mới dựng.
- Sau \`Pipe/Duct/CableTray.Create\` và \`BreakCurve\` luôn \`doc.Regenerate()\`.
- Nối bằng cặp connector gần nhất, không nối bằng index cứng.
- Dựng thử **chỉ hình học** trước (cờ \`createFittings\`) rồi mới bật sinh fitting — cách debug an toàn của BranchPipe1.

**Bước 4 — Transaction đúng mức** (xem 3.5): tool nhỏ → \`revit.Transaction\`; hàng loạt → 1 transaction + preprocessor; chia nhỏ nhiều bước → TransactionGroup + Assimilate.

**Bước 5 — Giao diện**: modal mặc định; nếu modeless phải ExternalEvent + guard \`doc.GetHashCode()\`; mọi control bọc \`hasattr\`.

**Bước 6 — Kiểm thử & an toàn dữ liệu**
- Test trên file sao chép; kiểm undo (phải Undo 1 phát là sạch).
- Bảo vệ dữ liệu như Auto Merge Duct (không xoá phần tử có nhiều connector).
- Có \`safety_counter\` cho vòng lặp vô hạn; lỗi từng phần tử không được giết cả batch.

### Quy ước code của dự án
- Chuỗi UI/thông báo **tiếng Việt có dấu** (UTF-8, header \`# -*- coding: utf-8 -*\`), tooltip bundle không dấu.
- Thông báo lỗi kèm **nguyên nhân + gợi ý** (VD: "Hãy load family ngã ba 45° (Wye 45°) hoặc Tee có tham số GÓC cổ nhánh.").
- Thông báo thân thiện cho người dùng cuối, copyright \`developed by Dong Tran Ba\` ở prompt/báo cáo.
- Tool cải tiến từ tool cũ: giữ tên, thêm đuôi \`Pro\` (Connect Spk → Connect Spk Pro; BOQ Pro → BOQ 3D Pro).

## 9. Sổ tay lưu ý & lỗi hay gặp

### 9.1. Lỗi đã fix trong dự án (không tái phạm)
| Lỗi | Fix |
|---|---|
| Dùng \`OST_Pipes\` (không tồn tại) | Dùng \`BuiltInCategory.OST_PipeCurves\` (Align Spk) |
| \`PartType.UnionFitting\` (không tồn tại) | \`MEPModel.PartType == PartType.Union\` (Auto Merge Duct) |
| XAML không tìm thấy khi dùng đường dẫn tương đối | \`os.path.join(os.path.dirname(__file__), 'ui.xaml')\` (3D WS) |
| Window WPF bị GC khi modeless | Gán vào biến toàn cục \`_workset_modeless_window_\` |
| Thao tác chéo document khi cửa sổ modeless mở | Guard \`doc.GetHashCode()\` trong handler (3D WS) |
| Warning fitting chặn hàng loạt | \`IFailuresPreprocessor\` + \`DeleteWarning\` |
| Tool đơ khi pipeline dài (Undo lag) | TransactionGroup + Assimilate + transaction nhỏ từng ống |
| Vòng lặp cắt ống vô hạn | \`safety_counter > 500\` → thoát khẩn cấp (Auto Split Duct) |
| \`BreakCurve\` lỗi do điểm sát mút ống | Thử lại lùi thêm 2 mm (Auto Split Duct) |
| Kết nối thất bại khi ống có độ dốc | Nội suy Z tại điểm XY (\`get_z_elevation\`) thay vì lấy Z đầu ống |
| Mất Taps khi merge ống | Đếm connector > 2 → giữ ống; cả 2 có taps → huỷ merge |

### 9.2. Những "bẫy" Revit API cần nhớ
1. **Đơn vị feet** — mọi phép tính mm phải /304.8, kể cả đường kính fitting.
2. **Regenerate trước khi đụng connector** mới tạo — lỗi phổ biến nhất.
3. **ConnectorType.Logical** không nối được — luôn lọc.
4. \`Category.Id.IntegerValue\` lỗi trên Revit 2024+ (ElementId Int64) — dùng helper \`_eid_int\`/try-catch.
5. Family Wye phải có **tham số góc cổ nhánh** và đủ 3 cổ trục — thư viện tự thử nhiều family và báo danh sách lỗi từng family.
6. View có **View Template** → override màu/visibility bị khoá (3D WS tắt nút, Color Systems cảnh báo).
7. \`IndependentTag.Create\` trả tag nhưng có thể chưa dùng đúng loại — phải \`ChangeTypeId\` theo category.
8. Sửa \`Location.Curve\` của ống có thể **đảo chiều** ống — kiểm hướng trước khi thụt (\`MoveEndPoint(extend=False)\`).
9. Selection trước khi chạy tool (\`GetElementIds\`) nên được ưu tiên hơn Pick — UX chuẩn của Align Spk/Connect to/Z-SKIP.
10. CSV tiếng Việt: dùng \`TextFieldParser\` (đọc đúng encoding + dấu ") thay vì \`split(',')\`.

### 9.3. File đặc biệt cần biết
| File | Đặc điểm |
|---|---|
| \`Dim Pro\\script.py\` | **Base64-encoded** — sửa phải decode (\`exec(compile(base64.b64decode(_c)...))\`) |
| \`lib\\plumbing_pro.py\` | Thư viện dùng chung, sửa 1 chỗ cả panel Plumbing hưởng |
| \`startup.py\` + \`ui.xaml\` | Chạy tự động khi load extension (cửa sổ chào) |
| \`Clash Check\\script.py\` | Tool lớn nhất dự án (~66KB), WinForms thuần, không XAML |
| \`BOQ Pro / BOQ 3D Pro\` | \`__persistentengine__ = True\` — engine cache dữ liệu giữa các lần chạy |
| \`ui.xaml\` của Auto Merge Duct / Auto Split Duct | Hộp thoại cấu hình + \`alert.xaml\` riêng cho kết quả |
| \`Z Elevation Level\\ZLevelPickerWindow.xaml\`, \`Align View\\AlignViews.xaml + AlignResult.xaml\` | XAML phụ load bằng \`script.get_bundle_file(...)\` |

### 9.4. Tóm tắt 1 dòng cho từng tool

| Tool | Vai trò |
|---|---|
| Align Spk | Căn thẳng + nối cụm ống đứng–côn–sprinkler |
| Auto Merge Duct | Khử Union, nối gộp ống gió thẳng hàng |
| Auto Split Duct | Cắt ống gió theo chiều dài chuẩn, chèn Union |
| BOQ Pro | Dashboard khối lượng MEP (WinForms) |
| BOQ 3D Pro | Dashboard khối lượng MEP 3D + hồ sơ lọc (WPF) |
| Clash Check | Check va chạm MEP vs A/S, xuất Excel/BCF |
| 3D WS | Bật tắt Workset trong 3D view |
| Color Element | Tô màu selection (50+ màu, 6 kiểu override) |
| Color Systems | Ép màu theo hệ thống + tạo Legend |
| Dim Pro | Tự dimension nhánh, chạy liên tục (code base64) |
| List Title Block | Chọn/lọc Title Block trên Sheet |
| Tagging Pro | Tag hàng loạt Pipe/Duct/Tray, chống chồng tag |
| Align View | Căn view trên nhiều sheet theo sheet chuẩn |
| Connect Spk / Spk Pro | Kết nối sprinkler với ống (3 option, nhớ cài đặt) |
| Z Elevation Level (Z-SKIP) | Dời phần tử về Level khác, báo cáo HTML |
| Chao Dong | Cửa sổ chào hỏi (demo WPF) |
| Conduit Tray | Vẽ Conduit bám tuyến Máng cáp |
| Excel Synch | Sửa tham số qua DataGrid / CSV / clipboard |
| Connect Brach / Connect to Main | Nối ống nhánh → ống chính (lẻ / hàng loạt) |
| Sheet & View Manager | Quản trị sheet, view, rename, placement |
| Model Tool (12 nút) | Bẻ co 90°/45° 4 hướng cho Pipe/Duct/Tray |
| Utility: 45 degree elbow | Đổi 1 co 90° thành 2 co 45° |
| Utility: Connect to / Disconnect | Nối / ngắt 2 cấu kiện |
| Plumbing: Branch 2/3/4/5/7/8 | Nối ống thoát nước Wye 45° (các biến thể khoảng lùi 1.5D–5D) |
| Plumbing: AxisPipe / Vent Riser | Nối nhánh vào trục đứng / ống thông khí |
| Plumbing: Connect Fixture | Kết nối thiết bị vệ sinh xuống ống chính (slope 2%) |

---
> © 2026 — Tài liệu tổng hợp cho extension **MyMEPTools.extension**. Developed by Dong Tran Ba.
`;

const BUILTIN_MYMEPTOOLS_DOC = {
  name: "TONG_HOP_KIEN_THUC_MyMEPTools.md",
  type: "md",
  content: BUILTIN_MYMEPTOOLS_CONTENT,
};

const ALL_BUILTIN_KNOWLEDGE_DOCS = [
  BUILTIN_MYMEPTOOLS_DOC,
];

function buildPyRevitKnowledgeContext(pyRevitContext: any, targetModel?: string): string {
  let rawDocs = (pyRevitContext?.documents || []).filter(
    (d: any) => d && d.enabled !== false && d.content && typeof d.content === "string"
  );

  let activeDocs: any[] = [BUILTIN_MYMEPTOOLS_DOC];

  rawDocs.forEach((d: any) => {
    if (!activeDocs.some((existing) => existing.name === d.name)) {
      activeDocs.push(d);
    }
  });

  const customRules = pyRevitContext?.customGuidelines?.trim() || "";
  const fileListNames = activeDocs.map((d: any) => `"${d.name}" (${(d.content.length / 1024).toFixed(1)} KB)`).join(", ");

  let contextBlock = `\n\n================================================================================
[BỘ NHỚ KHO TRI THỨC DÀNH RIÊNG CHO PYREVIT CODER (PYTHON) - BẮT BUỘC ĐỌC VÀ TUÂN THỦ 100%]
XÁC NHẬN HỆ THỐNG DÀNH CHO PYREVIT CODER:
Tài liệu quy chuẩn & mã nguồn Python extension "MyMEPTools.extension" ĐÃ ĐƯỢC NẠP TRỰC TIẾP VÀO CONTEXT THƯỜNG TRỰC CỦA BẠN.
Toàn bộ ${activeDocs.length} tệp Python/pyRevit dưới đây là nguồn tri thức cốt lõi duy nhất bắt buộc đọc và tuân thủ:
${fileListNames}

QUY TẮC BẮT BUỘC CHO PYREVIT CODER KHI PHẢN HỒI:
1. Bạn LUÔN LUÔN THAM CHIẾU VÀ ĐỐI CHIẾU VỚI TÀI LIỆU QUY CHUẨN TONG_HOP_KIEN_THUC_MyMEPTools.md TRƯỚC MỖI PHIÊN CHAT VÀ TRƯỚC KHI TRẢ LỜI / NHẢ CODE.
2. Khi người dùng hỏi bất kỳ câu nào như: "mày có đọc được file không", "file md tên gì", "đọc đi", "kiểm tra kho kiến thức", "file kho tên gì":
   -> BẠN PHẢI TRẢ LỜI NGAY VỚI THÁI ĐỘ TỰ TIN: "Tôi luôn mặc định đọc file TONG_HOP_KIEN_THUC_MyMEPTools.md trước mỗi phiên chat pyRevit!"
   -> Liệt kê các tệp pyRevit đang giữ: ${fileListNames}.
   -> Nêu tóm tắt 3-4 điểm chính trong kho kiến thức pyRevit (thư viện lib/plumbing_pro.py, 3 panel Dong's Tool, Model Tool, Plumbing, quy chuẩn 304.8 mm/feet, ConnectorUtils, PipeUtils...).
3. CHỈ tập trung vào lập trình Python / pyRevit API.
4. Khi lập trình pyRevit, bạn BẮT BUỘC tuân thủ đúng kiến trúc, hàm helper, và phong cách code được quy định trong tài liệu này (Ví dụ: SuppressWarnings, BreakCurve, ConnectorUtils, PipeUtils, _eid_int...).
`;

  if (customRules) {
    contextBlock += `\n[QUY CHUẨN VÀ HƯỚNG DẪN RIÊNG CỦA DỰ ÁN]:\n${customRules}\n`;
  }

  contextBlock += `\n[NỘI DUNG CHI TIẾT CỦA CÁC TỆP TRONG KHO TRI THỨC]:\n`;
  activeDocs.forEach((doc: any, index: number) => {
    const docName = doc.name || `Tài liệu ${index + 1}`;
    const docType = doc.type || "file";
    const truncatedContent = doc.content.length > 150000 ? doc.content.slice(0, 150000) + "\n...[Nội dung còn lại đã được nạp sẵn]..." : doc.content;
    contextBlock += `\n--- [BẮT ĐẦU TỆP ${index + 1}/${activeDocs.length}: "${docName}" (Loại tệp: .${docType})] ---\n${truncatedContent}\n--- [HẾT TỆP: "${docName}"] ---\n`;
  });

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

  // Model chuyên dụng cho lập trình pyRevit & Revit API Automation:
  // Chạy chính trên Gemini 3.6 Flash. Khi 3.6 hết limit/quota, hệ thống lập tức tự động trả về Gemini 3.1 Flash Lite.
  if (
    requestedModel === "pyrevit-code-pro" ||
    requestedModel === "pyrevit-code-specialist"
  ) {
    return ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
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
  const pyRevitKnowledge = buildPyRevitKnowledgeContext(pyRevitContext, model);
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
