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

// Client-side direct Google Gemini SDK (for Cloudflare Pages / Static Hosting)
async function streamDirectGemini(params: StreamChatParams) {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    enableSearch = true,
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

  const configPayload: any = {
    systemInstruction: getRealtimeSystemInstruction(systemInstruction),
  };

  if (enableSearch !== false) {
    configPayload.tools = [{ googleSearch: {} }];
  }

  if (enableThinking) {
    configPayload.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH,
    };
  }

  const targetModel = model || "gemini-3.6-flash";
  let activeModelUsed = targetModel;

  try {
    const stream = await ai.models.generateContentStream({
      model: targetModel,
      contents,
      config: configPayload,
    });

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

      const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
      let groundingSources: GroundingChunk[] | undefined;
      let webSearchQueries: string[] | undefined;

      if (groundingMetadata?.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
        groundingSources = groundingMetadata.groundingChunks
          .map((c: any) => ({
            title: c.web?.title || c.title || "Trang web",
            uri: c.web?.uri || c.uri || "",
          }))
          .filter((s: any) => s.uri);
      }

      if (groundingMetadata?.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
        webSearchQueries = groundingMetadata.webSearchQueries;
      }

      onChunk({
        text: textChunk,
        thought: thoughtChunk,
        model: activeModelUsed,
        groundingSources: groundingSources && groundingSources.length > 0 ? groundingSources : undefined,
        webSearchQueries: webSearchQueries && webSearchQueries.length > 0 ? webSearchQueries : undefined,
      });
    }
  } catch (err: any) {
    // Fallback smoothly to gemini-3.6-flash without failing search tool if requested model hits quota / unavailable
    try {
      const fallbackConfig: any = {
        systemInstruction: getRealtimeSystemInstruction(systemInstruction),
      };
      if (enableThinking) {
        fallbackConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const streamFallback = await ai.models.generateContentStream({
        model: "gemini-3.6-flash",
        contents,
        config: fallbackConfig,
      });

      for await (const chunk of streamFallback) {
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

        onChunk({
          text: textChunk,
          thought: thoughtChunk,
          model: "gemini-3.6-flash",
          fallbackReason: "Đã tự động kết nối qua kênh Gemini 3.6 Flash để đảm bảo thông suốt.",
        });
      }
    } catch (finalErr: any) {
      throw new Error(parseClientError(finalErr));
    }
  }
}

export async function sendChatMessage(params: StreamChatParams): Promise<void> {
  const { customApiKey, onChunk, signal } = params;

  // 1. If user provided their own API key, directly use the Google Gemini SDK (works 100% on Cloudflare)
  if (customApiKey && customApiKey.trim()) {
    return streamDirectGemini(params);
  }

  // 2. Otherwise try backend Express /api/gemini/stream first
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
      enableSearch: params.enableSearch !== false,
      model: params.model,
      systemInstruction: params.systemInstruction || undefined,
    };

    const response = await fetch("/api/gemini/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    // If server responds with 404 or 405 (Static hosting like Cloudflare Pages / Workers), prompt for API key
    if (response.status === 404 || response.status === 405) {
      throw new Error(
        "Ứng dụng đang chạy trên máy chủ tĩnh (Cloudflare). Vui lòng bấm vào icon Cài đặt (⚙️) ở góc trên bên phải để nhập Gemini API Key của bạn."
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
        if (parsed.error) throw new Error(parsed.error);

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
  } catch (err: any) {
    if (err.message && err.message.includes("Cloudflare")) {
      throw err;
    }
    // If network error or 405 occurred and no key provided:
    if (err.name !== "AbortError" && !customApiKey) {
      throw new Error(
        "Không thể kết nối đến backend (Lỗi " + (err.message || "") + "). Nếu bạn deploy lên Cloudflare, vui lòng mở Cài đặt (⚙️) và nhập Gemini API Key để chat trực tiếp."
      );
    }
    throw err;
  }
}
