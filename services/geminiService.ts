
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * 第一步：分析故事并生成包含全局一致性参数的中文分镜描述
 */
export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请深度分析以下故事，并将其分解为7-9个适合儿童绘本的关键时间序场景。

【核心任务：空间坐标与视觉逻辑锁死 (Spatial & Visual Logic Lock)】
为了解决角色走样和场景布局混乱的问题，请在生成分镜前执行以下逻辑设计：

1. **角色视觉档案 (Character Identity Guide)**：
   - 为每个主要角色设定绝对固定的特征（颜色、体型、标志性服饰）。例如：“猪大哥：圆滚滚，穿着带补丁的黄色背带裤，左耳有一个小缺口”。

2. **空间坐标系设计 (Spatial Distance Blueprint)**：
   - 设定一个全局固定的空间布局。例如：“森林中心是老大的草房，向右20米是老二的木房，再向右50米是老三的砖房”。
   - 在所有相关场景中，必须严格遵守这个相对位置和距离逻辑。

3. **尺寸一致性 (Scale Consistency)**：
   - 设定固定的比例关系。例如：“大灰狼的身高是小猪的两倍，砖房的高度是小猪的四倍”。

4. **提示词注入规则 (Prompt Injection Rule)**：
   - **核心要求**：每一个场景的 "imagePrompt" 必须包含上述【角色视觉档案】和【空间坐标系】的描述，确保即便单独生成某一张图，AI 也能获得一致的上下文。

每个场景必须包含：
- **imagePrompt**：必须以“全局一致性描述：[角色特征+空间位置关系]”开头，随后描述本场景的具体动作。必须使用中文。
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
                imagePrompt: { type: Type.STRING, description: "包含全局一致性描述（特征+空间距离）和当前动作的中文提示词" },
                storyText: { type: Type.STRING, description: "简短的中文绘本文字" }
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
 * 第二步：将包含一致性参数的中文描述优化为英文绘图指令
 */
export const generateSceneImage = async (chinesePrompt: string): Promise<string> => {
  const ai = getAI();

  try {
    // 将中文描述转换为纯净的英文提示词，强调空间和角色一致性
    const translationResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate and optimize this scene description for a consistent children's book illustration.
      CRITICAL: Maintain all character descriptions, spatial distances, and relative positions mentioned.
      Output ONLY the English prompt text.
      Style: 'Professional children's book illustration, consistent digital watercolor, soft cinematic lighting, 8k resolution, charming and safe'.
      
      Chinese Description: ${chinesePrompt}`,
    });

    const optimizedEnglishPrompt = translationResponse.text?.trim() || chinesePrompt;

    // 使用优化后的提示词生成图像
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `${optimizedEnglishPrompt}. Maintain character continuity, fixed spatial layout, no text, no distortion.` }
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
