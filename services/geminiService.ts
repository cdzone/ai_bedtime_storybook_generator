
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * 第一步：分析故事并生成中文分镜描述
 */
export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请分析以下故事，并将其分解为7-9个适合儿童绘本的关键时间序场景。

【核心任务：证据驱动的视觉叙事与角色一致性】
为了确保绘本中的画面与文字内容高度吻合，且逻辑严密，请严格执行以下规则：

1. **证据驱动的角色识别**：识别出每个场景中出现的确切人数和物种，确保角色成熟度符合逻辑。
2. **角色视觉白皮书**：为每个角色设定唯一的、简单的视觉特征（如：猪大哥穿黄色工装，猪二哥戴绿色帽子）。
3. **角色计数一致性**：画面描述中必须明确指出该场景中出现的具体角色及其数量。
4. **比例与物理逻辑**：确保人与物的比例真实且具有功能性。
5. **绝对禁令**：严禁裸露、暴力、令人困惑或恐怖的内容。
6. **语言要求**：画面描述必须使用【中文】编写。

每个场景必须包含：
- **imagePrompt**：详细的【中文】画面描述。
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
};

/**
 * 第二步：将中文描述优化为高质量的英文绘图指令，并生成图片
 */
export const generateSceneImage = async (chinesePrompt: string): Promise<string> => {
  const ai = getAI();

  try {
    // 1. 将中文描述转换为纯净的英文提示词
    const translationResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate and optimize this scene description for a children's book illustrator AI. 
      Output ONLY the English prompt text, no headers, no conversational filler.
      Style: 'Professional children's book illustration, masterful digital watercolor, soft volumetric lighting, cozy atmosphere, high resolution, clean and safe'.
      Ensure it is kid-friendly and safe.
      
      Description: ${chinesePrompt}`,
    });

    const optimizedEnglishPrompt = translationResponse.text?.trim() || chinesePrompt;

    // 2. 调用图像模型生成图片
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `${optimizedEnglishPrompt}. Whimsical, consistent character design, realistic scale, soft edges, no text in image, no violence.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("模型未返回内容，可能触发了内容安全过滤。");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("未能在响应中找到图像数据。");
  } catch (error: any) {
    console.error("Image generation error details:", error);
    throw new Error(error.message || "图像生成失败");
  }
};
