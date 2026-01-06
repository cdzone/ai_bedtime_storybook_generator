
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeStory = async (storyText: string): Promise<{ title: string; scenes: Omit<Scene, 'imageUrl'>[]; moral: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Please analyze the provided story and break it down into 5-6 key chronological scenes suitable for a children's picture book.

For each scene, you MUST provide:
Image Prompt:​ A detailed prompt for an image generator in the specified style: "soft watercolor children's book illustration, vibrant colors, cute characters, consistent style".
Story Text:​ The simplified story text in Chinese for that scene.
Crucially, you must review each scene against the following guidelines to ensure appropriateness and avoid misleading children:
【Factual Accuracy Check】:​ Ensure the scene depicts elements (e.g., animals, plants, natural phenomena, daily objects) truthfully. For instance, apples grow on trees, not on bushes; penguins live in polar regions, not in jungles.
【Logical Consistency Check】:​ Maintain continuity in character appearance, clothing, and environment across sequential scenes. Avoid sudden, unexplained changes (e.g., a character's shirt color shouldn't change randomly).
【Common Sense & Safety Check】: Depict behaviors and scenarios that are safe and align with common sense. For example, electrical outlets should not be shown as toys; crossing the street should involve looking both ways.
【Positive Values Check】:​ The scene should convey positive messages (like friendship, honesty, courage). Avoid any depictions of bullying, discrimination, or inappropriate fear-inducing elements.
By adhering to these guidelines, the generated content will be more realistic, educational, and suitable for young readers.
    
    Story: ${storyText}`,
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

export const generateSceneImage = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `${prompt}. High quality, 4k, artistic, cute.` }
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
