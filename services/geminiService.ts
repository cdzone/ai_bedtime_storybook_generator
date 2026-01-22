
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to call Gemini with exponential backoff for 429 errors
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(`Rate limit hit, retrying in ${Math.round(waitTime)}ms...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * 第一步：分析故事并生成包含全局一致性参数的中文分镜描述
 */
export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  return callWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `请深度分析以下故事，并将其分解为7-9个适合儿童绘本的关键时间序场景。

【核心任务：空间坐标与视觉逻辑锁死 (Spatial & Visual Logic Lock)】
为了解决角色走样和场景布局混乱的问题，请在生成分镜前执行以下逻辑设计：

1. **角色视觉档案 (Character Identity Guide)**：
   - 为每个主要角色设定绝对固定的特征（颜色、体型、标志性服饰）。

2. **空间坐标系设计 (Spatial Distance Blueprint)**：
   - 设定一个全局固定的空间布局和相对位置。

3. **尺寸一致性 (Scale Consistency)**：
   - 设定固定的比例关系。

4. **提示词注入规则 (Prompt Injection Rule)**：
   - 每一个场景的 "imagePrompt" 必须包含角色特征和空间位置关系描述。

每个场景必须包含：
- **imagePrompt**：以“全局一致性描述：[角色特征+空间位置关系]”开头。必须使用中文。
- **storyText**：对应的中文绘本叙述文字。

故事内容：${storyText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  imagePrompt: { type: Type.STRING },
                  storyText: { type: Type.STRING }
                },
                required: ["id", "imagePrompt", "storyText"]
              }
            },
            moral: { type: Type.STRING }
          },
          required: ["title", "scenes", "moral"]
        }
      }
    });

    return JSON.parse(response.text);
  });
};

/**
 * 第二步：生成图像
 */
export const generateSceneImage = async (chinesePrompt: string): Promise<string> => {
  const ai = getAI();

  // 1. Translation step
  const optimizedEnglishPrompt = await callWithRetry(async () => {
    const translationResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate to a clean, concise English image prompt for a children's book. 
      Output ONLY the English prompt.
      Style: "high-quality digital watercolor, soft lighting, consistent style, safe for kids".
      
      Chinese: ${chinesePrompt}`,
    });

    let text = translationResponse.text?.trim() || chinesePrompt;
    return text.replace(/^["']|["']$/g, '').replace(/^(Prompt|Image Prompt):\s*/i, '');
  });

  // 2. Image generation step
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `${optimizedEnglishPrompt}. Children's book illustration, whimsical atmosphere, no text.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      if (candidate?.finishReason === 'SAFETY') throw new Error("SAFETY_FILTER");
      throw new Error("EMPTY_RESPONSE");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("NO_IMAGE_DATA");
  });
};
