
export interface Scene {
  id: string; // Using string for easier key management during edits
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
  isEditing: boolean;
}
