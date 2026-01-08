
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

type PaperSize = 'A4' | 'A5' | 'Letter';
type LayoutType = 'one-per-page' | 'two-per-page' | 'grid';

const App: React.FC = () => {
  const [input, setInput] = useState(DEFAULT_STORY);
  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 打印配置
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [layout, setLayout] = useState<LayoutType>('one-per-page');

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
      setError("分析故事失败，可能是因为输入内容过于复杂或包含敏感词。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setStory(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scenes: prev.scenes.map(s => {
          if (s.id === id) {
            const newScene = { ...s, ...updates };
            // 重要：如果修改了画面描述，自动清除已有的图片 URL，以便触发重新生成
            if (updates.imagePrompt !== undefined && updates.imagePrompt !== s.imagePrompt) {
              newScene.imageUrl = undefined;
            }
            return newScene;
          }
          return s;
        })
      };
    });
  };

  const addScene = (index: number) => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      storyText: "新场景描述文字...",
      imagePrompt: "描述具体的画面内容...",
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

  const handleRetryScene = async (id: string) => {
    const scene = story?.scenes.find(s => s.id === id);
    if (!scene || !story) return;
    try {
      updateScene(id, { isGenerating: true, imageUrl: undefined });
      const url = await generateSceneImage(scene.imagePrompt);
      updateScene(id, { imageUrl: url, isGenerating: false });
    } catch (err: any) {
      updateScene(id, { isGenerating: false });
    }
  };

  const handleGenerateImages = async () => {
    if (!story) return;
    setStory(prev => prev ? { ...prev, isEditing: false, isProcessing: true } : null);
    
    // 我们必须获取最新的 scenes 状态
    const scenesToProcess = [...story.scenes];
    
    for (const scene of scenesToProcess) {
      // 只有在没有图片时才生成，因为 updateScene 已经在内容变化时清除了 imageUrl
      if (scene.imageUrl) continue;
      
      try {
        updateScene(scene.id, { isGenerating: true });
        const url = await generateSceneImage(scene.imagePrompt);
        updateScene(scene.id, { imageUrl: url, isGenerating: false });
      } catch (err: any) {
        console.error(`Failed to generate image for scene ${scene.id}`, err);
        updateScene(scene.id, { isGenerating: false });
      }
    }
    setStory(prev => prev ? { ...prev, isProcessing: false } : null);
  };

  const handlePrint = () => {
    if (!story) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('style, link')).map(s => s.outerHTML).join('');
    
    const scenesHtml = story.scenes.map((scene, idx) => `
      <div class="print-scene-card" style="${layout === 'one-per-page' ? 'page-break-after: always; min-height: 90vh; justify-content: center;' : ''}">
        <img src="${scene.imageUrl || ''}" alt="Scene ${idx + 1}" />
        <div class="print-scene-text">${scene.storyText}</div>
        <div style="margin-top: 10px; font-size: 10pt; color: #999;">- ${idx + 1} -</div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${story.title}</title>
          ${styles}
          <style>
            @page { size: ${paperSize}; margin: 20mm; }
            body { padding: 0; margin: 0; }
            .print-container { max-width: 100%; margin: 0 auto; }
            ${layout === 'two-per-page' ? '.print-scene-card { height: 45vh; border-bottom: 1px dashed #eee; padding-bottom: 20px; }' : ''}
            ${layout === 'grid' ? '.print-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }' : ''}
          </style>
        </head>
        <body>
          <div class="print-container">
            <h1 class="print-title">${story.title}</h1>
            ${scenesHtml}
            <div class="print-moral">
              <h3 style="margin-top:0; color: #c2410c;">🌟 故事寓意</h3>
              <p style="font-size: 16pt; italic: true;">"${story.moral}"</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
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

      {!story && !loading && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-orange-100 max-w-2xl mx-auto animate-fade-in">
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
            开始分镜设计 ✨
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse">
          <div className="w-20 h-20 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin mb-8"></div>
          <h2 className="text-2xl font-bold text-orange-600 text-center">正在为您进行分镜设计...<br/><span className="text-sm font-normal text-orange-400">这可能需要几秒钟时间</span></h2>
        </div>
      )}

      {story && story.isEditing && (
        <div className="space-y-8 animate-fade-in pb-20">
          <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-200 text-center sticky top-4 z-10 shadow-lg">
            <h2 className="text-2xl font-bold text-orange-700 mb-2">第二步：完善画面与文字</h2>
            <p className="text-orange-600">您可以直接修改下方的中文描述，确认后 AI 将为您绘图。修改描述会触发该页重新生成。</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {story.scenes.map((scene, index) => (
              <div key={scene.id} className="bg-white rounded-3xl p-6 shadow-md border-2 border-orange-100 flex flex-col md:flex-row gap-6 group relative">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  {index + 1}
                </div>
                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1 uppercase tracking-wider">画面念白</label>
                    <textarea 
                      value={scene.storyText}
                      onChange={(e) => updateScene(scene.id, { storyText: e.target.value })}
                      className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-orange-300 outline-none resize-none font-medium"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-blue-400 mb-1 uppercase tracking-wider">AI 画面指令 (中文)</label>
                    <textarea 
                      value={scene.imagePrompt}
                      onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      className="w-full p-3 border-2 border-blue-50 rounded-xl focus:border-blue-300 outline-none text-base bg-blue-50/30"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex md:flex-col gap-2 justify-center border-l pl-4 border-gray-100">
                  <button onClick={() => removeScene(scene.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  <button onClick={() => addScene(index)} className="p-2 text-green-300 hover:text-green-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => setStory(null)} className="px-8 py-4 text-gray-500 font-bold hover:text-gray-700">放弃并返回</button>
            <button 
              onClick={handleGenerateImages}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-12 rounded-2xl text-xl shadow-xl transition-all active:scale-95"
            >
              设计完成，生成绘本 🎨
            </button>
          </div>
        </div>
      )}

      {story && !story.isEditing && (
        <div className="space-y-12 animate-fade-in pb-20">
          <div className="no-print bg-white p-6 rounded-3xl shadow-lg border-2 border-orange-100 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 space-y-4">
                <h3 className="text-xl font-bold text-orange-700 flex items-center gap-2">
                  <span>🖨️</span> 打印选项设置
                </h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-400 block mb-1">纸张尺寸</label>
                    <select 
                      value={paperSize} 
                      onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                      className="w-full p-2 border-2 border-orange-50 rounded-lg outline-none focus:border-orange-300"
                    >
                      <option value="A4">A4 (标准)</option>
                      <option value="A5">A5 (精装小本)</option>
                      <option value="Letter">Letter (信纸)</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-400 block mb-1">页面布局</label>
                    <select 
                      value={layout} 
                      onChange={(e) => setLayout(e.target.value as LayoutType)}
                      className="w-full p-2 border-2 border-orange-50 rounded-lg outline-none focus:border-orange-300"
                    >
                      <option value="one-per-page">每页一张图 (大幅画)</option>
                      <option value="two-per-page">每页两张图 (横版)</option>
                      <option value="grid">两列网格 (紧凑)</option>
                    </select>
                  </div>
                </div>
              </div>
              <button 
                onClick={handlePrint}
                disabled={story.isProcessing}
                className={`px-10 py-5 rounded-2xl font-bold text-xl shadow-xl transition-all flex items-center gap-3 ${story.isProcessing ? 'bg-gray-200 text-gray-400' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
              >
                <span>🖨️</span> 立即打印绘本
              </button>
            </div>
          </div>

          <div id="printable-story" className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">{story.title}</h2>
              {story.isProcessing && (
                <div className="flex items-center justify-center gap-2 text-orange-500 font-medium no-print">
                   <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                   <span>AI 画师正在全力绘图中...</span>
                </div>
              )}
            </div>

            <div className={`grid gap-8 ${layout === 'grid' ? 'grid-cols-1 md:grid-cols-2' : layout === 'two-per-page' ? 'grid-cols-1' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
              {story.scenes.map((scene, index) => (
                <div key={scene.id} className="relative group">
                   <StoryCard scene={{...scene, id: index + 1}} />
                   {!scene.imageUrl && !scene.isGenerating && !story.isProcessing && (
                     <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center p-6 text-center rounded-3xl no-print border-4 border-dashed border-red-200">
                        <p className="text-red-500 font-bold mb-4">生成出现了一些问题</p>
                        <button 
                          onClick={() => handleRetryScene(scene.id)}
                          className="bg-orange-500 text-white px-8 py-2 rounded-full font-bold hover:bg-orange-600 transition shadow-lg"
                        >
                          重新生成
                        </button>
                     </div>
                   )}
                </div>
              ))}
            </div>

            <div className="moral-section bg-orange-100 p-8 rounded-3xl text-center border-4 border-dashed border-orange-300 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-orange-700 mb-3">🌟 故事寓意</h3>
              <p className="text-xl text-orange-900 leading-relaxed italic">"{story.moral}"</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 no-print">
            <button 
              onClick={() => setStory(prev => prev ? {...prev, isEditing: true} : null)}
              className="text-orange-600 font-bold hover:underline"
            >
              ← 修改分镜内容
            </button>
            <button 
              onClick={() => setStory(null)}
              className="text-gray-400 font-medium hover:text-gray-600"
            >
              创建另一个故事
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xl mx-auto mt-8 bg-red-50 border-2 border-red-100 p-6 rounded-3xl text-center text-red-600 animate-bounce">
          <p className="font-bold mb-4">{error}</p>
          <button onClick={() => setError(null)} className="bg-red-500 text-white px-6 py-2 rounded-full font-bold">确定</button>
        </div>
      )}
    </div>
  );
};

export default App;
