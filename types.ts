
export interface Scene {
  id: number;
  imagePrompt: string;
  storyText: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface StoryState {
  title: string;
  scenes: Scene[];
  moral: string;
  isProcessing: boolean;
}
