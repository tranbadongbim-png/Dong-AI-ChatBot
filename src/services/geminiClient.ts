import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ChatImage, GroundingChunk } from "../types";

export interface StreamChatParams {
  prompt: string;
  history?: { role: "user" | "model"; text: string; images?: ChatImage[] }[];
  images?: ChatImage[];
  enableThinking?: boolean;
  enableSearch?: boolean;
  model?: string;
  systemInstruction?: string;
  pyRevitContext?: any;
  customApiKey?: string;
  onChunk: (chunk: {
    text: string;
    thought?: string;
    model?: string;
    fallbackReason?: string;
    groundingSources?: GroundingChunk[];
    webSearchQueries?: string[];
  }) => void;
  signal?: AbortSignal;
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

  const timeContext = `[THÔNG TIN THỜI GIAN THỰC HỆ THỐNG]:
- Hôm nay là: ${formattedDate}
- Thời gian hiện tại: ${formattedTime} (Năm ${now.getFullYear()})
Bạn là trợ lý AI thông minh sử dụng mô hình Gemini mới nhất của Google. Bạn luôn nắm bắt chính xác ngày giờ hiện tại, thông tin và sự kiện mới nhất. Khi người dùng hỏi về thời gian, ngày tháng, tin tức, thời tiết hoặc dữ liệu hiện tại, hãy sử dụng mốc thời gian này và tìm kiếm thông tin mới nhất trên Google để trả lời chính xác.`;

  if (userCustomInstruction && userCustomInstruction.trim()) {
    return `${timeContext}\n\n[HƯỚNG DẪN TÙY BIẾN CỦA NGƯỜI DÙNG]:\n${userCustomInstruction.trim()}`;
  }
  return timeContext;
}

function formatSdkAttachment(att: ChatImage) {
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
          codeText = atob(att.data.split(",")[1]);
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

  // Binary/PDF/Image
  const base64Data = att.data.includes(",") ? att.data.split(",")[1] : att.data;
  const mimeType = att.mimeType || (att.name?.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

function formatSdkContents(
  prompt: string,
  history: { role: "user" | "model"; text: string; images?: ChatImage[] }[] = [],
  images: ChatImage[] = []
) {
  const contents: any[] = [];
  
  console.log("Formatting contents, prompt:", prompt, "history length:", history?.length, "images length:", images?.length);

  if (history && history.length > 0) {
    for (const msg of history) {
      const parts: any[] = [];
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          parts.push(formatSdkAttachment(img));
        }
      }
      if (msg.text) {
        parts.push({ text: msg.text });
      }
      if (parts.length > 0) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts,
        });
      }
    }
  }

  const currentParts: any[] = [];
  if (images && images.length > 0) {
    for (const img of images) {
      currentParts.push(formatSdkAttachment(img));
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
  
  console.log("Formatted contents:", JSON.stringify(contents, null, 2));

  return contents;
}

function parseClientError(err: any): string {
  if (!err) return "Đã xảy ra lỗi không xác định.";
  let rawMsg = typeof err === "string" ? err : err.message || String(err);

  if (typeof err === "object" && err?.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed.error?.message) {
        rawMsg = parsed.error.message;
      }
    } catch {
      // Not JSON
    }
  }

  if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("Quota exceeded")) {
    const retryMatch = rawMsg.match(/retry in ([0-9ms\.\s]+)/i) || rawMsg.match(/retryDelay"?:\s*"([0-9a-z]+)"/i);
    const retryInfo = retryMatch ? ` Vui lòng chờ khoảng ${retryMatch[1]} rồi bấm "Tạo lại".` : "";
    return `API Key của bạn đã đạt giới hạn lượt gọi (Free Tier Limit trên dự án này).${retryInfo}\n\n👉 Giải pháp: Tạo thêm 1 API Key mới miễn phí tại Google AI Studio (aistudio.google.com) và dán vào Cài đặt (⚙️) là tiếp tục chat được ngay!`;
  }

  return rawMsg;
}

// Client-side web search helper for Cloudflare / static browser hosting
async function clientFetchLiveWebSearch(query: string): Promise<{ title: string; uri: string; snippet: string }[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    // Try fetching via free CORS proxy to DuckDuckGo HTML
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;

    const resp = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    const html = await resp.text();
    const results: { title: string; uri: string; snippet: string }[] = [];

    // Parse DuckDuckGo HTML results
    const linkRegex = /<a\s+class="result__url"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const urls: { uri: string; title: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && urls.length < 6) {
      let rawUri = match[1] || "";
      if (rawUri.includes("uddg=")) {
        try {
          const matchUddg = rawUri.match(/uddg=([^&]+)/);
          if (matchUddg) rawUri = decodeURIComponent(matchUddg[1]);
        } catch {
          // ignore
        }
      }
      const title = match[2]?.replace(/<[^>]+>/g, "").trim() || "Trang web";
      if (rawUri.startsWith("http")) {
        urls.push({ uri: rawUri, title });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 6) {
      snippets.push(match[1]?.replace(/<[^>]+>/g, "").trim() || "");
    }

    for (let i = 0; i < urls.length; i++) {
      results.push({
        title: urls[i].title,
        uri: urls[i].uri,
        snippet: snippets[i] || urls[i].title,
      });
    }

    return results;
  } catch {
    return [];
  }
}

const PYREVIT_SPECIALIST_INSTRUCTION = `
BẠN LÀ CHUYÊN GIA LẬP TRÌNH PYREVIT & AUTODESK REVIT API HÀNG ĐẦU (pyRevit Senior Developer & BIM Automation Specialist cho dự án MyMEPTools.extension).

QUY TẮC TỐI CAO BẮT BUỘC CHO PYCODER:
1. BẮT BUỘC THAM CHIẾU TÀI LIỆU TRƯỚC KHI TRẢ LỜI & NHẢ CODE:
   - Trước khi đưa ra bất kỳ phản hồi, giải thích hay đoạn mã Python nào, bạn PHẢI LUÔN THAM CHIẾU VÀ ĐỐI CHIẾU VỚI TÀI LIỆU QUY CHUẨN \`TONG_HOP_KIEN_THUC_MyMEPTools.md\`.
   - Trong phần đầu câu trả lời, hãy LUÔN NÊU RÕ: "Đã đối chiếu với tài liệu quy chuẩn TONG_HOP_KIEN_THUC_MyMEPTools.md" và tóm tắt ngắn gọn quy chuẩn/hàm helper liên quan.

2. TUÂN THỦ 100% CÁC TIÊU CHUẨN VÀ HÀM HELPER TRONG TÀI LIỆU:
   - Thư viện helper cốt lõi: Ưu tiên sử dụng các lớp/hàm helper trong \`lib/plumbing_pro.py\` (\`ConnectorUtils\`, \`PipeUtils\`, \`_eid_int\`, \`SuppressWarnings\`...).
   - Quy chuẩn đơn vị: Đơn vị nội bộ Revit DB là Feet (1 ft = 304.8 mm). Luôn chuyển đổi chính xác qua \`304.8\` hoặc \`UnitUtils\`.
   - Cấu trúc thư mục Extension chuẩn: \`MyMEPTools.extension/MyMEPTools.tab/.../*.panel/*.pushbutton/script.py\`.
   - Bẫy sập Revit API: Gọi \`doc.Regenerate()\` sau \`BreakCurve\` trước khi lấy Connector mới, bọc Transaction an toàn, và tự động xử lý cảnh báo (Suppress Warnings).

3. CẤU TRÚC MÃ PYREVIT CHUẨN:
# -*- coding: utf-8 -*-
__title__ = "Tên Công Cụ"
__author__ = "MyMEPTools"
__doc__ = """Mô tả chức năng công cụ."""

from pyrevit import revit, DB, UI, script, forms
doc = revit.doc
uidoc = revit.uidoc

4. PHONG CÁCH PHẢN HỒI:
   - Cung cấp code Python pyRevit hoàn chỉnh, chú thích tiếng Việt rõ ràng, kèm vị trí lưu file trong extension (.extension/.tab/.panel/.pushbutton/script.py).
`;

function formatKnowledgeContextForClient(pyRevitContext: any, model?: string): string {
  if (!pyRevitContext) return "";

  let rawDocs = (pyRevitContext?.documents || []).filter(
    (d: any) => d && d.enabled !== false && d.content && typeof d.content === "string"
  );

  if (rawDocs.length === 0) return "";

  const customRules = pyRevitContext?.customGuidelines?.trim() || "";
  const fileListNames = rawDocs.map((d: any) => `"${d.name}"`).join(", ");

  let contextBlock = `\n\n[BỘ NHỚ KHO TRI THỨC PYREVIT DỰ ÁN]:\nDanh sách tệp nạp sẵn: ${fileListNames}\n`;
  if (customRules) {
    contextBlock += `[HƯỚNG DẪN RIÊNG]: ${customRules}\n`;
  }
  rawDocs.forEach((doc: any, i: number) => {
    contextBlock += `\n--- [TỆP ${i + 1}: "${doc.name}"] ---\n${doc.content}\n--- [HẾT TỆP: "${doc.name}"] ---\n`;
  });
  return contextBlock;
}

// Client-side direct Google Gemini SDK (for Cloudflare Pages / Static Hosting)
async function streamDirectGemini(params: StreamChatParams) {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    enableSearch = false,
    model = "gemini-3.6-flash",
    systemInstruction,
    customApiKey,
    onChunk,
  } = params;

  if (!customApiKey) {
    throw new Error("Vui lòng nhập Google Gemini API Key trong menu Cài đặt (góc trên bên phải) để trò chuyện trên Cloudflare.");
  }

  const ai = new GoogleGenAI({ apiKey: customApiKey });
  const contents = formatSdkContents(prompt, history, images);
  const isPyRevitModel = model === "pyrevit-code-pro" || model === "pyrevit-code-specialist";
  const preferredModel = model === "gemini-flash-lite-latest" ? "gemini-3.1-flash-lite" : (model || "gemini-3.6-flash");
  
  let candidateModels: string[];
  if (enableThinking) {
    candidateModels = ["gemini-3.8-flash", "gemini-3.6-flash"];
  } else if (isPyRevitModel) {
    candidateModels = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
  } else {
    candidateModels = [
      preferredModel,
      ...["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"].filter(
        (m) => m !== preferredModel
      ),
    ];
  }

  let totalTextReceived = 0;
  let totalThoughtReceived = 0;

  const handleChunkData = (
    textChunk: string,
    thoughtChunk: string,
    activeModel: string,
    fallbackReason?: string,
    groundingSources?: GroundingChunk[],
    webSearchQueries?: string[]
  ) => {
    if (textChunk) totalTextReceived += textChunk.length;
    if (thoughtChunk) totalThoughtReceived += thoughtChunk.length;

    onChunk({
      text: textChunk,
      thought: thoughtChunk,
      model: isPyRevitModel ? "pyrevit-code-pro" : activeModel,
      fallbackReason,
      groundingSources,
      webSearchQueries,
    });
  };

  // Direct Live Web Search + Gemini without the blocked native tool (to avoid 429 quota block completely)
  try {
    let searchContext = "";
    let webSources: GroundingChunk[] = [];

    if (enableSearch && prompt) {
      const liveResults = await clientFetchLiveWebSearch(prompt);
      if (liveResults.length > 0) {
        webSources = liveResults.map((r) => ({ title: r.title, uri: r.uri }));
        searchContext = `\n\n[DỮ LIỆU TÌM KIẾM WEB THỜI GIAN THỰC TỪ INTERNET]:\n` +
          liveResults.map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.uri}\nNội dung: ${r.snippet}`).join("\n\n") +
          `\n\nHãy tổng hợp thông tin mới nhất từ dữ liệu web trên để trả lời đầy đủ, chính xác cho người dùng.`;
      }
    }

    const knowledgeBlock = formatKnowledgeContextForClient(params.pyRevitContext, model);
    const baseInstruction =
      (systemInstruction ? systemInstruction + "\n" : "") +
      (isPyRevitModel ? PYREVIT_SPECIALIST_INSTRUCTION + "\n" : "") +
      knowledgeBlock +
      searchContext;
    const fallbackInstruction = getRealtimeSystemInstruction(baseInstruction);

    const fallbackConfig: any = {
      systemInstruction: fallbackInstruction,
    };
    if (enableThinking) {
      fallbackConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    let activeModelUsed = candidateModels[0];
    for (const candModel of candidateModels) {
      try {
        const stream = await ai.models.generateContentStream({
          model: candModel,
          contents,
          config: fallbackConfig,
        });

        activeModelUsed = candModel;
        for await (const chunk of stream) {
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

          handleChunkData(
            textChunk,
            thoughtChunk,
            activeModelUsed,
            candModel !== candidateModels[0] ? `Đã chuyển sang ${candModel} do mô hình chính quá tải.` : (webSources.length > 0 ? "Đã tra cứu dữ liệu web thời gian thực trực tuyến." : undefined),
            webSources.length > 0 ? webSources : undefined,
            webSources.length > 0 ? [prompt] : undefined
          );
        }

        if (totalTextReceived > 0) {
          return;
        }
      } catch (streamAttemptErr: any) {
        console.warn(`Direct stream attempt for ${candModel} failed:`, streamAttemptErr?.message);
      }
    }
  } catch (streamErr: any) {
    console.warn("Client streaming failed, attempting non-streaming generateContent fallback:", streamErr?.message);
  }

  // Attempt 3: Non-streaming generateContent as ultimate guarantee across candidate models
  for (const candModel of candidateModels) {
    try {
      const directResp = await ai.models.generateContent({
        model: candModel,
        contents,
        config: {
          systemInstruction: getRealtimeSystemInstruction(systemInstruction),
        },
      });

      let finalText = "";
      const parts = directResp.candidates?.[0]?.content?.parts;
      if (parts && Array.isArray(parts)) {
        for (const p of parts) {
          if (p.text) finalText += p.text;
        }
      }
      if (!finalText && directResp.text) {
        finalText = directResp.text;
      }

      if (finalText) {
        handleChunkData(finalText, "", candModel, `Đã phản hồi qua kênh ${candModel} dự phòng.`);
        return;
      }
    } catch (finalErr: any) {
      console.warn(`Direct generateContent attempt for ${candModel} failed:`, finalErr?.message);
    }
  }

  if (totalTextReceived === 0) {
    if (enableThinking) {
      throw new Error(
        "Không thể hoàn thành câu trả lời ở Chế độ High Thinking: Cả hai mô hình Gemini 3.8 Flash và Gemini 3.6 Flash đều không phản hồi (có thể do lỗi quá tải 503 hoặc giới hạn hạn ngạch 429). Hệ thống không hạ cấp sang các mô hình Flash Lite khác để đảm bảo chất lượng suy luận. Vui lòng thử lại sau giây lát hoặc tắt Chế độ High Thinking."
      );
    }
    throw new Error("Không nhận được nội dung từ Gemini API. Vui lòng kiểm tra lại API Key hoặc quota của tài khoản Google AI Studio.");
  }
}

export async function sendChatMessage(params: StreamChatParams): Promise<void> {
  const { customApiKey, onChunk, signal } = params;

  // 1. If user provided their own API key, directly use the Google Gemini SDK (works 100% on Cloudflare or custom quota)
  if (customApiKey && customApiKey.trim()) {
    return streamDirectGemini(params);
  }

  // 2. Otherwise use backend Express /api/gemini/stream
  let response: Response;
  try {
    const payload = {
      prompt: params.prompt,
      history: params.history,
      images: params.images?.map((img) => ({
        data: img.data,
        mimeType: img.mimeType,
        name: img.name,
        fileType: img.fileType,
        textContent: img.textContent,
        size: img.size,
      })),
      enableThinking: params.enableThinking,
      enableSearch: Boolean(params.enableSearch),
      model: params.model,
      systemInstruction: params.systemInstruction || undefined,
      pyRevitContext: params.pyRevitContext || undefined,
    };

    response = await fetch("/api/gemini/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    throw new Error(
      "Không thể kết nối đến máy chủ (" +
        (err.message || "Lỗi mạng") +
        "). Vui lòng kiểm tra lại kết nối hoặc nhập API Key trong phần Cài đặt (⚙️)."
    );
  }

  // If server responds with 404 or 405 (e.g. static hosting without Express backend), prompt for API key
  if (response.status === 404 || response.status === 405) {
    throw new Error(
      "Ứng dụng đang chạy ở chế độ máy chủ tĩnh. Vui lòng bấm vào icon Cài đặt (⚙️) ở góc trên bên phải để nhập Gemini API Key cá nhân của bạn."
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Yêu cầu thất bại với mã trạng thái ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Không thể đọc luồng dữ liệu từ máy chủ.");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();

      if (dataStr === "[DONE]") break;

      const parsed = JSON.parse(dataStr);
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      onChunk({
        text: parsed.text || "",
        thought: parsed.thought || "",
        model: parsed.model,
        fallbackReason: parsed.fallbackReason,
        groundingSources: parsed.groundingSources,
        webSearchQueries: parsed.webSearchQueries,
      });
    }
  }
}
