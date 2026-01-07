
import React, { useState } from 'react';
import { analyzeStory, generateSceneImage } from './services/geminiService';
import { Scene, StoryState } from './types';
import StoryCard from './components/StoryCard';

const DEFAULT_STORY = `今日睡前故事：三只小猪

在美丽的森林里，三只小猪渐渐长大了。猪妈妈觉得它们应该独立生活了，于是给它们每人一些钱，让它们去盖一座属于自己的房子。

老大比较懒，他用稻草盖了一间房子。老二也想省事，他用木头盖了一间房子。只有老三最勤快，他辛辛苦苦地搬来砖头，砌了一间坚固的砖房。

不久，森林里来了一只大灰狼。大灰狼先来到了老大的草房前，用力一吹，草房就倒了。老大吓得赶紧跑到了老二家。大灰狼又来到老二的木房前，用力一撞，木房也倒了。老大和老二拼命跑到了老三的砖房里。

大灰狼对着砖房又是吹又是撞，可砖房纹丝不动。最后，大灰狼想从烟囱爬进去，老三早就在烟囱下面烧了一锅开水。大灰狼掉进锅里，烫得尾巴都焦了，惨叫着逃回了森林，再也不敢回来了。

三只小猪从此过上了幸福快乐的生活。这个故事告诉我们：做人不能图省事，只有辛勤劳动、脚踏实地，才能收获真正的安全和幸福。`;

const App: React.FC = () => {
  const [input, setInput] = useState(DEFAULT_STORY);
  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: Analyze story into editable scenes
  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeStory(input);
      setStory({
        title: analysis.title,
        moral: analysis.moral,
        scenes: analysis.scenes.map((s, idx) => ({
          ...s,
          id: `scene-${Date.now()}-${idx}`,
          isGenerating: false
        })),
        isEditing: true,
        isProcessing: false
      });
    } catch (err: any) {
      setError("分析故事失败，请检查网络或重试。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Scene Editing Helpers
  const updateScene = (id: string, updates: Partial<Scene>) => {
    setStory(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    } : null);
  };

  const addScene = (index: number) => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      storyText: "新场景描述...",
      imagePrompt: "Describe the visuals for the drawing engine...",
      isGenerating: false
    };
    setStory(prev => {
      if (!prev) return null;
      const newScenes = [...prev.scenes];
      newScenes.splice(index + 1, 0, newScene);
      return { ...prev, scenes: newScenes };
    });
  };

  const removeScene = (id: string) => {
    setStory(prev => prev ? {
      ...prev,
      scenes: prev.scenes.filter(s => s.id !== id)
    } : null);
  };

  // Phase 2: Confirm and start image generation
  const handleGenerateImages = async () => {
    if (!story) return;
    setStory(prev => prev ? { ...prev, isEditing: false, isProcessing: true } : null);

    const scenesToProcess = [...story.scenes];
    
    for (const scene of scenesToProcess) {
      try {
        updateScene(scene.id, { isGenerating: true });
        const url = await generateSceneImage(scene.imagePrompt);
        updateScene(scene.id, { imageUrl: url, isGenerating: false });
      } catch (err) {
        console.error(`Failed for scene ${scene.id}`, err);
        updateScene(scene.id, { isGenerating: false });
      }
    }
    setStory(prev => prev ? { ...prev, isProcessing: false } : null);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-story');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('style, link')).map(s => s.outerHTML).join('');
    printWindow.document.write(`
      <html>
        <head>
          <title>${story?.title || '绘本'}</title>
          ${styles}
        </head>
        <body>
          <div class="max-w-4xl mx-auto p-10">${printContent.innerHTML}</div>
          <script>setTimeout(() => { window.print(); }, 1000);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="text-center mb-10 no-print">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-600 mb-4 flex items-center justify-center gap-3">
          <span>🎨</span> 绘本工坊
        </h1>
        <p className="text-orange-800 text-lg opacity-80">让每一个睡前故事都拥有专属画面</p>
      </header>

      {/* STEP 1: INPUT */}
      {!story && !loading && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-orange-100 max-w-2xl mx-auto">
          <label className="block text-xl font-bold text-gray-700 mb-4">第一步：粘贴你的小故事</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-80 p-6 text-lg border-2 border-orange-200 rounded-2xl focus:ring-4 focus:ring-orange-300 outline-none mb-6 shadow-inner"
            placeholder="在这里输入故事内容..."
          />
          <button
            onClick={handleAnalyze}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 rounded-2xl text-xl shadow-lg transition transform hover:-translate-y-1"
          >
            分析故事分镜 ✨
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin mb-8"></div>
          <h2 className="text-2xl font-bold text-orange-600">正在整理故事情节...</h2>
        </div>
      )}

      {/* STEP 2: EDITING */}
      {story && story.isEditing && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-200 text-center">
            <h2 className="text-2xl font-bold text-orange-700 mb-2">第二步：完善分镜设计</h2>
            <p className="text-orange-600">您可以修改文字、调整提示词，或者增删场景，确保符合您的想象。</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {story.scenes.map((scene, index) => (
              <div key={scene.id} className="bg-white rounded-3xl p-6 shadow-md border-2 border-orange-100 flex flex-col md:flex-row gap-6 group relative">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  {index + 1}
                </div>
                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">绘本文字 (孩子听到的)</label>
                    <textarea 
                      value={scene.storyText}
                      onChange={(e) => updateScene(scene.id, { storyText: e.target.value })}
                      className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-orange-300 outline-none resize-none"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-blue-400 mb-1 uppercase tracking-wider">画面提示词 (AI 看到的绘图指令)</label>
                    <textarea 
                      value={scene.imagePrompt}
                      onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      className="w-full p-3 border-2 border-blue-50 rounded-xl focus:border-blue-200 outline-none text-sm font-mono"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex md:flex-col gap-2 justify-center">
                  <button 
                    onClick={() => removeScene(scene.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                    title="删除此场景"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <button 
                    onClick={() => addScene(index)}
                    className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-full transition"
                    title="在此之后插入场景"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-4 pb-12">
            <button 
              onClick={() => setStory(null)}
              className="px-8 py-4 text-gray-500 font-bold hover:text-gray-700"
            >
              取消并返回
            </button>
            <button 
              onClick={handleGenerateImages}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-12 rounded-2xl text-xl shadow-xl transition transform hover:-translate-y-1"
            >
              确认并开始绘图 🎨
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VIEWING / GENERATING */}
      {story && !story.isEditing && (
        <div className="space-y-12">
          <div id="printable-story" className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">{story.title}</h2>
              {story.isProcessing && (
                <div className="flex items-center justify-center gap-2 text-orange-500 font-medium no-print">
                   <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                   <span>AI 画师正在逐页绘制，请稍候...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {story.scenes.map((scene, index) => (
                <div key={scene.id} className="story-card">
                   <StoryCard scene={{...scene, id: index + 1}} />
                </div>
              ))}
            </div>

            <div className="moral-section bg-orange-100 p-8 rounded-3xl text-center border-4 border-dashed border-orange-300">
              <h3 className="text-2xl font-bold text-orange-700 mb-3">🌟 故事寓意</h3>
              <p className="text-xl text-orange-900 leading-relaxed italic">"{story.moral}"</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-4 pb-20 no-print">
            {!story.isProcessing && (
              <>
                <button 
                  onClick={handlePrint}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-10 rounded-full shadow-lg transition flex items-center gap-3"
                >
                  <span>🖨️</span> 打印完整绘本
                </button>
                <button 
                  onClick={() => setStory(prev => prev ? {...prev, isEditing: true} : null)}
                  className="bg-white text-orange-500 border-2 border-orange-500 font-bold py-4 px-10 rounded-full hover:bg-orange-50 transition"
                >
                  修改分镜设计
                </button>
                <button 
                  onClick={() => setStory(null)}
                  className="text-gray-400 font-medium hover:text-gray-600"
                >
                  开始新故事
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xl mx-auto mt-8 bg-red-50 border-2 border-red-100 p-6 rounded-3xl text-center text-red-600">
          <p className="font-bold mb-4">{error}</p>
          <button onClick={() => setError(null)} className="underline font-bold">我知道了</button>
        </div>
      )}
    </div>
  );
};

export default App;
