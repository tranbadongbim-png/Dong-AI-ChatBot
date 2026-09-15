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
    defaultModel: "gemini-3.6-flash",
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
          codeText = Buffer.from(att.data.split(",")[1], "base64").toString("utf-8");
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

  // Binary / Media files (PDF, Images)
  const base64Data = att.data?.includes(",")
    ? att.data.split(",")[1]
    : att.data || "";

  let mimeType = att.mimeType;
  if (!mimeType) {
    if (att.name?.toLowerCase().endsWith(".pdf")) {
      mimeType = "application/pdf";
    } else {
      mimeType = "image/jpeg";
    }
  }

  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

// Helper to format messages into Gemini SDK contents
function formatContents(
  prompt: string,
  history: ChatHistoryItem[] = [],
  images: AttachmentPayload[] = []
) {
  const contents: any[] = [];

  // Add conversation history if present
  if (history && history.length > 0) {
    for (const msg of history) {
      const parts: any[] = [];
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          parts.push(formatAttachmentPart(img));
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

  // Current user turn
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

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post("/api/gemini/stream", async (req, res) => {
  const {
    prompt,
    history = [],
    images = [],
    enableThinking = false,
    model = "gemini-3.6-flash",
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

  // Models to attempt: requested model first
  let requestedModel = model || "gemini-3.6-flash";
  let targetModel = requestedModel;
  let fallbackReason = "";

  const configPayload: any = {};
  if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
    configPayload.systemInstruction = systemInstruction.trim();
  }

  if (enableThinking) {
    configPayload.thinkingConfig = {
      thinkingLevel: ThinkingLevel.HIGH,
    };
    // Do NOT set maxOutputTokens when thinking is enabled
  }

  // Attempt streaming with fallback
  let stream: any = null;
  let activeModelUsed = targetModel;

  try {
    stream = await ai.models.generateContentStream({
      model: targetModel,
      contents,
      config: configPayload,
    });
  } catch (initialErr: any) {
    const errText = initialErr?.message || "";
    const is503Unavailable = errText.includes("503") || errText.includes("high demand") || errText.includes("UNAVAILABLE");
    const is429OrQuota = errText.includes("429") || errText.includes("quota") || errText.includes("RESOURCE_EXHAUSTED");

    if (is503Unavailable || is429OrQuota || targetModel !== "gemini-3.6-flash") {
      try {
        console.log(`Model ${targetModel} unavailable/quota-limited. Falling back smoothly to gemini-3.6-flash...`);
        activeModelUsed = "gemini-3.6-flash";
        fallbackReason = is429OrQuota && targetModel === "gemini-3.1-pro-preview"
          ? "Mô hình Gemini 3.1 Pro yêu cầu gói trả phí API Key. Đã tự động chuyển sang Gemini 3.6 Flash để hỗ trợ bạn ngay."
          : is429OrQuota
          ? "Đã vượt hạn ngạch gói miễn phí của mô hình này. Tự động chuyển sang Gemini 3.6 Flash để tiếp tục."
          : "Máy chủ Gemini hiện đang bận tạm thời. Đã tự động chuyển sang kênh Gemini 3.6 Flash để trả lời ngay.";

        const fallbackConfig: any = { ...configPayload };
        if (enableThinking) {
          fallbackConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH,
          };
        }

        stream = await ai.models.generateContentStream({
          model: "gemini-3.6-flash",
          contents,
          config: fallbackConfig,
        });
      } catch (fallbackErr: any) {
        const cleanMsg = extractErrorMessage(fallbackErr);
        res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }
    } else {
      const cleanMsg = extractErrorMessage(initialErr);
      res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }
  }

  // Stream output to client
  let hasSentAnyData = false;
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

      hasSentAnyData = true;
      const payload = {
        text: textChunk,
        thought: thoughtChunk,
        model: activeModelUsed,
        fallbackReason: fallbackReason || undefined,
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Gemini Stream Chunk Error:", error);

    // If we failed before sending any text and were not already on gemini-3.6-flash, recover immediately!
    if (!hasSentAnyData && activeModelUsed !== "gemini-3.6-flash") {
      try {
        console.log("Recovering stream with gemini-3.6-flash...");
        activeModelUsed = "gemini-3.6-flash";
        fallbackReason = "Máy chủ bận (503). Đã tự động kết nối qua kênh Gemini 3.6 Flash để phản hồi ngay.";
        
        const fallbackConfig: any = { ...configPayload };
        if (enableThinking) {
          fallbackConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH,
          };
        }

        const recoveryStream = await ai.models.generateContentStream({
          model: "gemini-3.6-flash",
          contents,
          config: fallbackConfig,
        });

        for await (const chunk of recoveryStream) {
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

          const payload = {
            text: textChunk,
            thought: thoughtChunk,
            model: activeModelUsed,
            fallbackReason,
          };

          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      } catch (recoveryErr: any) {
        console.log("Recovery stream failed:", recoveryErr?.message);
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
    model = "gemini-3.6-flash",
    systemInstruction,
  } = req.body;

  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: "Yêu cầu phải có câu lệnh (prompt) hoặc hình ảnh." });
    return;
  }

  try {
    const ai = getAIClient();

    let targetModel = model || "gemini-3.6-flash";
    const configPayload: any = {};

    if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
      configPayload.systemInstruction = systemInstruction.trim();
    }

    if (enableThinking) {
      configPayload.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    const contents = formatContents(prompt, history, images);
    let activeModel = targetModel;
    let fallbackNotice = "";
    let response: any = null;

    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: configPayload,
      });
    } catch (initialErr: any) {
      const errText = initialErr?.message || "";
      const is503 = errText.includes("503") || errText.includes("high demand") || errText.includes("UNAVAILABLE");
      const is429 = errText.includes("429") || errText.includes("quota") || errText.includes("RESOURCE_EXHAUSTED");

      if (is503 || is429 || targetModel !== "gemini-3.6-flash") {
        activeModel = "gemini-3.6-flash";
        fallbackNotice = is429 && targetModel === "gemini-3.1-pro-preview"
          ? "Mô hình Gemini 3.1 Pro yêu cầu gói trả phí API Key. Đã tự động dùng Gemini 3.6 Flash để trả lời."
          : is503
          ? "Tự động chuyển kênh dự phòng Gemini 3.6 Flash do máy chủ đang quá tải."
          : "Tự động chuyển kênh dự phòng Gemini 3.6 Flash.";
        
        const fallbackConfig: any = { ...configPayload };
        if (enableThinking) {
          fallbackConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH,
          };
        }

        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents,
          config: fallbackConfig,
        });
      } else {
        throw initialErr;
      }
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

    res.json({
      text: mainText,
      thought: thoughtText,
      model: activeModel,
      fallbackNotice: fallbackNotice || undefined,
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
