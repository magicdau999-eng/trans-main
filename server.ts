import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TranslateItemInput {
  id: string;
  text: string;
  context?: string;
  lineCount?: number;
}

interface TranslateRequestBody {
  items?: TranslateItemInput[];
  targetLanguage?: string;
  tone?: 'natural' | 'faithful' | 'casual';
  glossary?: string;
  apiKey?: string;
}

interface TranslatedItemOutput {
  id: string;
  translated: string;
}

function getGeminiClient(overrideKey?: string): GoogleGenAI {
  const apiKey = overrideKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(
      new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong mục Settings > Secrets.'),
      { statusCode: 400 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(
  targetLanguage: string,
  tone: 'natural' | 'faithful' | 'casual',
  glossary?: string
): string {
  const toneGuide =
    tone === 'faithful'
      ? 'Translate faithfully and accurately, closely following the source phrasing while staying grammatical.'
      : tone === 'casual'
        ? 'Translate with lively, conversational, gamer-friendly phrasing suitable for modern RPG dialogue.'
        : 'Translate as a professional video game localizer: natural, atmospheric, concise, and emotionally resonant.';

  const glossarySection =
    glossary && glossary.trim().length > 0
      ? `\n\nMandatory Glossary / Character Name Rules (follow strictly):\n${glossary.trim()}`
      : '';

  return [
    `You are an expert RPG Maker MV/MZ game localizer translating game data strings into ${targetLanguage}.`,
    toneGuide,
    '',
    'CRITICAL RULES:',
    '1. Preserve ALL RPG Maker escape codes and placeholders verbatim without altering letters, brackets, or numbers:',
    '   Examples: \\V[1], \\N[1], \\P[1], \\C[2], \\I[64], \\G, \\{, \\}, \\$, \\., \\|, \\!, \\>, \\<, \\^, \\\\, %1, %2, %3, <...>.',
    '2. Preserve the exact number of newline breaks (\\n) when lineCount > 1 so dialogue fits inside the in-game message window.',
    '3. Keep UI terms, skill/item names, and choices concise so they do not overflow buttons or menus.',
    '4. Return a JSON array where every input item id has its corresponding translated string. Do not skip, merge, or invent ids.',
    glossarySection,
  ].join('\n');
}

async function translateBatchWithRetry(
  ai: GoogleGenAI,
  items: TranslateItemInput[],
  targetLanguage: string,
  tone: 'natural' | 'faithful' | 'casual',
  glossary?: string
): Promise<TranslatedItemOutput[]> {
  const systemInstruction = buildSystemInstruction(targetLanguage, tone, glossary);
  const payload = items.map((item) => ({
    id: item.id,
    context: item.context ?? '',
    lineCount: item.lineCount ?? 1,
    text: item.text,
  }));

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Each attempt has its own independent 90-second timeout to prevent hanging
    const timeoutSignal = AbortSignal.timeout(90_000);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify(payload),
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: 'Exact item id from the input array.',
                },
                translated: {
                  type: Type.STRING,
                  description: 'Translated text in the target language preserving all escape codes.',
                },
              },
              required: ['id', 'translated'],
            },
          },
          // Pass the timeout signal through httpOptions if supported
          httpOptions: { signal: timeoutSignal } as never,
        },
      });

      const rawJson = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawJson) as TranslatedItemOutput[];
      if (!Array.isArray(parsed)) {
        throw new Error('Phản hồi từ Gemini không đúng định dạng mảng JSON.');
      }
      return parsed;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isAbortTimeout =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError');
      const isTransient =
        isAbortTimeout ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('DEADLINE_EXCEEDED') ||
        msg.includes('socket hang up');

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }

      const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const statusOverride =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode)
      : undefined;
  const raw = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (statusOverride) {
    return { status: statusOverride, message: raw };
  }
  if (name === 'TimeoutError' || raw.includes('ETIMEDOUT') || raw.includes('DEADLINE_EXCEEDED') || raw.includes('socket hang up')) {
    return {
      status: 504,
      message: 'Gemini API không phản hồi sau 90 giây. Lô dịch quá lớn hoặc mạng chậm — hãy thử lại.',
    };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Khóa Gemini API không hợp lệ hoặc bị từ chối quyền. Vui lòng kiểm tra lại trong Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Đã chạm giới hạn lượt gọi Gemini API (429). Vui lòng chờ vài giây hoặc nhấn Tiếp tục để dịch tiếp.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: 'Model Gemini không khả dụng (404). Vui lòng thử lại sau.',
    };
  }
  return { status: 500, message: raw || 'Lỗi máy chủ khi gọi Gemini API.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/translate', async (req, res) => {
    try {
      const body = (req.body ?? {}) as TranslateRequestBody;
      const items = Array.isArray(body.items) ? body.items : [];
      const targetLanguage =
        typeof body.targetLanguage === 'string' && body.targetLanguage.trim().length > 0
          ? body.targetLanguage.trim()
          : 'Vietnamese';
      const tone =
        body.tone === 'faithful' || body.tone === 'casual' ? body.tone : 'natural';
      const glossary = typeof body.glossary === 'string' ? body.glossary : '';

      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : undefined;

      if (items.length === 0) {
        res.status(400).json({ error: 'Danh sách chuỗi cần dịch đang trống.' });
        return;
      }

      if (items.length > 80) {
        res.status(400).json({ error: 'Mỗi lô dịch tối đa 80 chuỗi để đảm bảo độ chính xác.' });
        return;
      }

      const ai = getGeminiClient(apiKey);
      const translations = await translateBatchWithRetry(
        ai,
        items,
        targetLanguage,
        tone,
        glossary
      );

      res.json({ translations });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`RPGM Lingua server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
