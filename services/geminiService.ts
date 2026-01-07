
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请分析以下故事，并将其分解为7-9个适合儿童绘本的关键时间序场景。

【核心任务：证据驱动的视觉叙事与角色一致性】
为了确保绘本中的画面与文字内容高度吻合，且逻辑严密，请严格执行以下规则：

1. **证据驱动的角色识别 (Evidence-Based Character Identification)**：
   - **角色数量识别**：仔细阅读文本，识别出每个场景中出现的**确切人数和物种**。例如：“猪妈妈和三只小猪”意味着场景中必须出现4个角色。
   - **年龄与成熟度推断**：从故事情节寻找线索。若提到“长大了”、“独立生活”，角色形象必须从“婴儿/幼童比例”转变为“少年/青年比例”，不再使用尿不湿或奶嘴等低幼元素。
   - **角色视觉白皮书**：为每个识别出的角色设定唯一的视觉特征（如：猪大哥穿黄色工装裤，猪二哥戴绿色鸭舌帽，猪三哥穿蓝色背带裤，猪妈妈戴粉色围裙）。

2. **角色计数一致性 (Character Count Logic)**：
   - 在每个场景的 Image Prompt 中，必须明确指出该场景中出现的**具体角色及其数量**。如果文本说“三只小猪聚在一起”，提示词严禁只画一只。

3. **比例、尺度与物理逻辑 (Scale & Physics)**：
   - **交互比例**：确保人与物的比例真实。例如：猪宝宝盖的房子必须大到能容纳其站立或躺下。
   - **物理动作**：动作应有质感（如搬砖的沉重感、盖房子的忙碌感），严禁怪异肢体。

4. **全局环境蓝图 (Environmental Blueprint)**：
   - 设定并锁定一个全局地理背景（如：郁郁葱葱的橡树林边缘，地面有碎石小路）。
   - 地标建筑（如小猪们的房子）在建成后，必须在后续相关场景的背景中以相同的外观出现。

5. **内容安全与艺术风格 (Safety & Style)**：
   - **内容红线**：严禁裸露、暴力、令人困惑的内容。确保所有角色穿着得体、特征鲜明。
   - 风格词："Professional high-end children's book illustration, masterful digital watercolor, whimsical and cozy, soft volumetric lighting, warm color palette, clear storytelling composition, safe and adorable."

每个场景必须包含：
- **Image Prompt**：详细的英文提示词。结构：[场景内确切角色数量与特征描述] + [全局背景描述] + [符合尺度逻辑的当前动作描述] + [风格安全词]。
- **Story Text**：对应的中文绘本叙述文字。

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
                imagePrompt: { type: Type.STRING, description: "Detailed prompt derived from text evidence, ensuring exact character count and consistent maturity/clothing" },
                storyText: { type: Type.STRING, description: "Short Chinese story text" }
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
  const finalPrompt = `${prompt}. Storytelling masterpiece, high-end children's book style, consistent character design, realistic scale relative to environment, child-friendly, high resolution.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: finalPrompt }
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
