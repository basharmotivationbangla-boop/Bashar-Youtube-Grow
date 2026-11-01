import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize server-side Google GenAI client per gemini-api skill
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Gemini Multi-Turn Chatbot Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, prompt } = req.body;

    if ((!messages || !Array.isArray(messages) || messages.length === 0) && !prompt) {
      return res.status(400).json({ error: 'Messages array or prompt is required' });
    }

    // Recommended model per skill: gemini-3.8-flash
    const model = 'gemini-3.8-flash';

    const systemInstruction = `You are "Bashar YouTube Grow AI" (বশার ইউটিউব গ্রো এআই সহকারী), the official intelligent YouTube Growth & Content Strategy Assistant for the platform created by Bashar Motivation Bangla (basharmotivationbangla@gmail.com).
Your mission is to help YouTube creators, vloggers, gamers, and educators dramatically increase their organic views, watch time, subscribers, CTR (Click-Through Rate), and search ranking.

Core Responsibilities:
1. YouTube SEO & Viral Titles: Generate catchy, high-CTR Bengali & English video titles, descriptions, and high-ranking tags (#shorts, keywords).
2. Watch Time Optimization: Provide proven pacing, hook tactics (first 15 seconds), and story structure tips so viewers stay glued to the video.
3. Bashar Platform Guide: Explain how the community watch-to-earn model works (1 second watch = 1 credit, 500 welcome credits, 1,000 credits referral reward, create campaigns to boost real views).
4. Tone & Style: Inspiring, highly energetic, practical, friendly, and motivational.
5. Language: You respond fluently in Bengali (বাংলা) or English, adapting seamlessly to the user's language. Use clear markdown formatting, bullet points, and emojis.`;

    let contents: any[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      contents = messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text || m.content || '' }],
      }));
    } else if (prompt) {
      contents = [{ role: 'user', parts: [{ text: String(prompt) }] }];
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    const replyText = response.text || 'দুঃখিত, কোনো উত্তর তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
    return res.json({ text: replyText, model });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini API Error',
      details: error?.toString(),
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
