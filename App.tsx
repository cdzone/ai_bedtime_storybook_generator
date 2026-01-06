
import React, { useState, useEffect, useCallback } from 'react';
import { analyzeStory, generateSceneImage } from './services/geminiService';
import { Scene, StoryState } from './types';
import StoryCard from './components/StoryCard';

const DEFAULT_STORY = `今日睡前故事：乌鸦喝水

从前，有一只乌鸦飞了很久很久，口渴得嗓子都要冒烟了。它四处寻找水源，终于在一个小村庄附近发现了一个瓶子。乌鸦高兴极了，连忙飞过去，可是当它凑近一看，却皱起了眉头。

原来，这个瓶子里的水很少，只有瓶底一点点。乌鸦把嘴伸进瓶口，可是瓶口太小，水又太浅，它怎么也喝不到水。乌鸦急得团团转，心想：这可怎么办呀？难道要渴死在这里吗？

乌鸦围着瓶子转来转去，突然，它看到地上有许多小石子。它灵机一动，想出了一个好办法。乌鸦用嘴衔起一颗小石子，小心翼翼地放进瓶子里。只听"咚"的一声，石子沉到了瓶底，水面升高了一点点。

乌鸦高兴极了，它又衔起第二颗石子，第三颗石子……就这样，乌鸦不辞辛苦地来回奔波，一颗一颗地把小石子放进瓶子里。每放一颗石子，水面就升高一点点。虽然很累，但乌鸦没有放弃，它知道只要坚持下去，就一定能喝到水。

终于，当乌鸦放了很多很多石子后，水面升到了瓶口。乌鸦终于可以喝到水了！它大口大口地喝着清凉的水，感觉浑身都舒服极了。

这个故事告诉我们，遇到困难时不要轻易放弃，要像乌鸦一样开动脑筋想办法，用智慧和坚持去解决问题。只要肯动脑筋，再大的困难也能克服！`;

const App: React.FC = () => {
  const [input, setInput] = useState(DEFAULT_STORY);
  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStoryboard = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    setStory(null);

    try {
      // 1. Analyze and break down the story
      const analysis = await analyzeStory(input);
      
      const initialScenes: Scene[] = analysis.scenes.map(s => ({
        ...s,
        isGenerating: true
      }));

      setStory({
        title: analysis.title,
        scenes: initialScenes,
        moral: analysis.moral,
        isProcessing: true
      });

      // 2. Generate images sequentially or in batches (sequential here for stability)
      for (const scene of initialScenes) {
        try {
          const url = await generateSceneImage(scene.imagePrompt);
          setStory(prev => {
            if (!prev) return null;
            return {
              ...prev,
              scenes: prev.scenes.map(s => 
                s.id === scene.id ? { ...s, imageUrl: url, isGenerating: false } : s
              )
            };
          });
        } catch (err) {
          console.error(`Failed to generate image for scene ${scene.id}`, err);
        }
      }

      setStory(prev => prev ? { ...prev, isProcessing: false } : null);
    } catch (err) {
      console.error(err);
      setError("哎呀，故事分析出了点小差错。请检查网络或重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-600 mb-4 flex items-center justify-center gap-3">
          <span>📖</span> 绘本工坊
        </h1>
        <p className="text-orange-800 text-lg opacity-80">
          把你的故事变成美丽的连环画
        </p>
      </header>

      {!story && !loading && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-orange-100 max-w-2xl mx-auto">
          <label className="block text-xl font-bold text-gray-700 mb-4">输入你的故事内容：</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-64 p-4 text-lg border-2 border-orange-200 rounded-2xl focus:ring-4 focus:ring-orange-300 focus:border-orange-500 transition-all outline-none resize-none mb-6"
            placeholder="粘贴你的故事..."
          />
          <button
            onClick={handleCreateStoryboard}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-xl shadow-lg transition transform hover:-translate-y-1 active:scale-95"
          >
            开始绘制 🎨
          </button>
        </div>
      )}

      {loading && !story && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-orange-600 mb-2">正在分析故事场景...</h2>
          <p className="text-gray-500">正在把你的故事拆解成一幕幕精彩的画面</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-600 p-4 rounded-2xl mb-8 text-center font-bold">
          {error}
        </div>
      )}

      {story && (
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{story.title}</h2>
            {story.isProcessing && (
              <p className="text-orange-500 animate-pulse font-medium">插图正在快马加鞭赶来...</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {story.scenes.map((scene) => (
              <StoryCard key={scene.id} scene={scene} />
            ))}
          </div>

          <div className="bg-orange-100 p-8 rounded-3xl text-center border-4 border-dashed border-orange-300">
            <h3 className="text-2xl font-bold text-orange-700 mb-3">🌟 故事寓意</h3>
            <p className="text-xl text-orange-900 leading-relaxed italic">
              "{story.moral}"
            </p>
          </div>

          <div className="flex justify-center pb-10">
            <button 
              onClick={() => setStory(null)}
              className="bg-white text-orange-500 border-2 border-orange-500 font-bold py-3 px-8 rounded-full hover:bg-orange-50 transition"
            >
              绘制另一个故事
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
