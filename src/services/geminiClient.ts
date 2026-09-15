import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ChatImage } from "../types";

export interface StreamChatParams {
  prompt: string;
  history?: { role: "user" | "model"; text: string; images?: { data: string; mimeType: string }[] }[];
  images?: ChatImage[];
  enableThinking?: boolean;
  model?: string;
  systemInstruction?: string;
  customApiKey?: string;
  onChunk: (chunk: { text: string; thought?: string; model?: string; fallbackReason?: string }) => void;
  signal?: AbortSignal;
}

function formatSdkContents(
  prompt: string,
  history: { role: "user" | "model"; text: string; images?: { data: string; mimeType: string }[] }[] = [],
  images: ChatImage[] = []
) {
  const contents: any[] = [];

  if (history && history.length > 0) {
    for (const msg of history) {
      const parts: any[] = [];
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          const base64Data = img.data.includes(",") ? img.data.split(",")[1] : img.data;
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: img.mimeType || "image/jpeg",
            },
          });
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
      const base64Data = img.data.includes(",") ? img.data.split(",")[1] : img.data;
      currentParts.push({
        inlineData: {
          data: base64Data,
          mimeType: img.mimeType || "image/jpeg",
        },
      });
    }
  }
  if (prompt) {
    currentParts.push({ text: prompt });
  }

  if (currentParts.length > 0) {
    contents.push({
      role: "user",
      parts: currentParts,
    });
  }

  return contents;
}

// Client-side fallback using direct Google Gemini SDK (for Cloudflare Pages / Static Hosting)
async function streamDirectGemini(params: StreamChatParams) {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    model = "gemini-2.5-flash",
    systemInstruction,
    customApiKey,
    onChunk,
  } = params;

  if (!customApiKey) {
    throw new Error("Vui lòng nhập Google Gemini API Key trong menu Cài đặt (góc trên bên phải) để trò chuyện trên Cloudflare.");
  }

  const ai = new GoogleGenAI({ apiKey: customApiKey });
  const contents = formatSdkContents(prompt, history, images);

  const configPayload: any = {};
  if (systemInstruction && systemInstruction.trim()) {
    configPayload.systemInstruction = systemInstruction.trim();
  }

  if (enableThinking) {
    configPayload.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH,
    };
  }

  const targetModel = model || "gemini-2.5-flash";
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

      onChunk({
        text: textChunk,
        thought: thoughtChunk,
        model: activeModelUsed,
      });
    }
  } catch (err: any) {
    // Fallback smoothly to gemini-2.5-flash if requested model hits quota / unavailable
    if (targetModel !== "gemini-2.5-flash") {
      const fallbackReason = "Đã tự động đổi sang Gemini 2.5 Flash để đảm bảo kết nối ổn định.";
      const streamFallback = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
        config: configPayload,
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
          model: "gemini-2.5-flash",
          fallbackReason,
        });
      }
    } else {
      throw err;
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
      })),
      enableThinking: params.enableThinking,
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
