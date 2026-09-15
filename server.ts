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

  return rawMsg;
}

// Live web search crawler for resilient fallback when native Google Search Grounding hits 429/503
async function fetchLiveWebSearch(query: string): Promise<{ title: string; uri: string; snippet: string }[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

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

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post("/api/gemini/stream", async (req, res) => {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    enableSearch = false,
    model = "gemini-3.8-flash",
    systemInstruction,
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

  let targetModel = model || "gemini-3.8-flash";
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
      }
    } catch (searchErr) {
      console.warn("Live web search fetch failed:", searchErr);
    }
  }

  const configPayload: any = {
    systemInstruction: getRealtimeSystemInstruction((systemInstruction ? systemInstruction + "\n" : "") + searchContext),
  };

  if (enableThinking) {
    configPayload.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH,
    };
  }

  let stream: any = null;
  let activeModelUsed = targetModel;

  try {
    stream = await ai.models.generateContentStream({
      model: targetModel,
      contents,
      config: configPayload,
    });
  } catch (initialErr: any) {
    console.error("Stream generation error:", initialErr);
    const cleanMsg = extractErrorMessage(initialErr);
    res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
    return;
  }

  // Stream output to client
  let totalTextReceived = "";
  let totalThoughtReceived = "";

  try {
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
        model: activeModelUsed,
        fallbackReason: fallbackReason || undefined,
        groundingSources: groundingSources && groundingSources.length > 0 ? groundingSources : undefined,
        webSearchQueries: webSearchQueries && webSearchQueries.length > 0 ? webSearchQueries : undefined,
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    // Safety check: If stream finished with 0 text (e.g. tool output only without final candidate text)
    if (!totalTextReceived.trim()) {
      console.log("Empty text stream detected. Generating non-streaming response fallback...");
      try {
        const searchResults = await fetchLiveWebSearch(prompt);
        let searchContext = "";
        if (searchResults.length > 0) {
          searchContext = `\n\n[KẾT QUẢ TÌM KIẾM WEB THỜI GIAN THỰC CHO: "${prompt}"]:\n` +
            searchResults.map((r, i) => `[${i + 1}] Tiêu đề: ${r.title}\nURL: ${r.uri}\nTóm tắt: ${r.snippet}`).join("\n\n") +
            `\nHãy sử dụng các kết quả tìm kiếm thời gian thực này để trả lời đầy đủ, chi tiết câu hỏi của người dùng.`;
        }
        const nonStreamResp = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: getRealtimeSystemInstruction(systemInstruction) + searchContext,
          },
        });

        const fallbackText = nonStreamResp.text || "Đã hoàn tất tìm kiếm và tổng hợp thông tin.";
        res.write(`data: ${JSON.stringify({
          text: fallbackText,
          model: "gemini-3.8-flash",
          groundingSources: searchResults.map((r) => ({ title: r.title, uri: r.uri })),
          webSearchQueries: [prompt.slice(0, 100)],
        })}\n\n`);
      } catch (err: any) {
        console.error("Non-stream fallback error:", err);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Gemini Stream Chunk Error:", error);

    // If stream failed during execution and we got no text yet, recover immediately!
    if (!totalTextReceived.trim()) {
      try {
        console.log("Recovering stream with live web search + gemini-3.8-flash...");
        const searchResults = await fetchLiveWebSearch(prompt);
        let searchContext = "";
        if (searchResults.length > 0) {
          searchContext = `\n\n[KẾT QUẢ TÌM KIẾM WEB THỜI GIAN THỰC]:\n` +
            searchResults.map((r, i) => `[${i + 1}] ${r.title} (${r.uri})\n${r.snippet}`).join("\n\n") +
            `\nHãy sử dụng thông tin trên để trả lời đầy đủ, rõ ràng cho người dùng.`;
        }

        const recoveryResp = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: getRealtimeSystemInstruction(systemInstruction) + searchContext,
          },
        });

        res.write(`data: ${JSON.stringify({
          text: recoveryResp.text || "Đã xử lý thông tin yêu cầu của bạn.",
          model: "gemini-3.8-flash",
          fallbackReason: "Đã chuyển qua kênh tra cứu trực tiếp để đảm bảo phản hồi thông suốt.",
          groundingSources: searchResults.map((r) => ({ title: r.title, uri: r.uri })),
          webSearchQueries: [prompt.slice(0, 100)],
        })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      } catch (recErr: any) {
        console.error("Recovery failed:", recErr);
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
    model = "gemini-3.8-flash",
    systemInstruction,
  } = req.body;

  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: "Yêu cầu phải có câu lệnh (prompt) hoặc hình ảnh." });
    return;
  }

  try {
    const ai = getAIClient();

    let targetModel = model || "gemini-3.8-flash";
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

    const configPayload: any = {
      systemInstruction: getRealtimeSystemInstruction((systemInstruction ? systemInstruction + "\n" : "") + searchContext),
    };

    if (enableThinking) {
      configPayload.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    const contents = formatContents(prompt, history, images);
    let activeModel = targetModel;
    let response: any = null;

    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: configPayload,
      });
    } catch (initialErr: any) {
      console.warn(`GenerateContent error with model ${targetModel}, retrying simple config:`, initialErr?.message);
      const simpleConfig: any = {
        systemInstruction: getRealtimeSystemInstruction(systemInstruction),
      };
      if (enableThinking) {
        simpleConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }
      activeModel = "gemini-3.8-flash";
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: simpleConfig,
      });
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
      model: activeModel,
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
