
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请分析以下故事，并将其分解为5-6个适合儿童绘本的关键时间序场景。

为了确保绘本中主角形象的一致性（Consistency），请遵循以下步骤：
1. **角色设定**：首先定义故事主角的详细外貌特征（例如：一只羽毛乌黑发亮、有着橘黄色小尖嘴、眼睛大而明亮、脖子上围着一条红色小围巾的小乌鸦）。
2. **场景拆解**：针对每个场景，生成包含该主角特征的绘图提示词。

每个场景必须包含：
- **Image Prompt**：英文绘图提示词。必须包含统一的艺术风格限定词："Soft professional children's book watercolor illustration, bright and warm colors, clean white background style, charming and expressive character design"。
- **核心要求**：每一个 Image Prompt 必须开头就重复描述主角的固定外貌特征，确保 AI 生成图片时角色不走样。
- **Story Text**：该场景对应的中文简短故事文本。

【逻辑一致性检查】：
- 主角在所有场景中的外貌、配饰、颜色必须完全一致。
- 背景环境（如瓶子的形状、周围的草地）应保持连贯。

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
                imagePrompt: { type: Type.STRING, description: "Detailed English prompt including consistent character description" },
                storyText: { type: Type.STRING, description: "Short Chinese story text for this scene" }
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

export const generateSceneImage = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `${prompt}. Masterpiece, consistent style, high detail, adorable character design, child-friendly.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("Failed to generate image");
};
