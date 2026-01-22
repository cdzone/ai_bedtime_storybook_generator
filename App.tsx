
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
      if (err.message?.includes('429')) {
        setError("API 配额已耗尽或请求太频繁，请稍等一分钟后再试。");
      } else {
        setError("分析故事失败，请尝试简化故事内容。");
      }
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
            return { ...s, ...updates };
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

  const handleGenerateSingle = async (id: string) => {
    const scene = story?.scenes.find(s => s.id === id);
    if (!scene || !story) return;
    try {
      updateScene(id, { isGenerating: true, imageUrl: undefined });
      const url = await generateSceneImage(scene.imagePrompt);
      updateScene(id, { imageUrl: url, isGenerating: false });
    } catch (err: any) {
      updateScene(id, { isGenerating: false });
      alert(err.message === "SAFETY_FILTER" ? "画面描述可能涉及敏感内容，请修改后重试。" : "生成失败：" + err.message);
    }
  };

  const handleGenerateAllMissing = async () => {
    if (!story) return;
    setStory(prev => prev ? { ...prev, isProcessing: true } : null);
    
    for (let i = 0; i < story.scenes.length; i++) {
      const scene = story.scenes[i];
      if (scene.imageUrl || scene.isGenerating) continue;
      
      try {
        updateScene(scene.id, { isGenerating: true });
        if (i > 0) await new Promise(r => setTimeout(r, 1000)); 
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
        <div class="print-page-number">
          <span class="page-badge">${idx + 1}</span>
        </div>
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
            .print-page-number { margin-top: 20px; display: flex; justify-content: center; width: 100%; }
            .page-badge {
              background-color: #ea580c; color: white; width: 40px; height: 40px;
              border-radius: 50%; display: flex; align-items: center; justify-content: center;
              font-weight: bold; font-size: 16pt; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              border: 3px solid white; -webkit-print-color-adjust: exact;
            }
            ${layout === 'two-per-page' ? '.print-scene-card { height: 45vh; border-bottom: 2px dashed #fed7aa; padding-bottom: 20px; }' : ''}
            ${layout === 'grid' ? '.print-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }' : ''}
          </style>
        </head>
        <body>
          <div class="print-container">
            <h1 class="print-title">${story.title}</h1>
            ${scenesHtml}
            <div class="print-moral">
              <h3 style="margin-top:0; color: #c2410c;">🌟 故事寓意</h3>
              <p style="font-size: 16pt; font-style: italic;">"${story.moral}"</p>
            </div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 1200); };
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
          <div className="bg-white p-6 rounded-3xl border-4 border-orange-200 sticky top-4 z-20 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h2 className="text-2xl font-bold text-orange-700">分镜审阅与画面生成</h2>
              <p className="text-orange-600 text-sm">在这里修改文字、调整提示词并直接预览画面。</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleGenerateAllMissing}
                disabled={story.isProcessing}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
              >
                {story.isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>🚀</span>}
                一键生成全部画面
              </button>
              <button 
                onClick={() => setStory({...story, isEditing: false})}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
              >
                <span>✨</span> 生成绘本成品
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {story.scenes.map((scene, index) => (
              <div key={scene.id} className="bg-white rounded-3xl p-6 shadow-lg border-2 border-orange-100 flex flex-col lg:flex-row gap-8 relative overflow-hidden group">
                {/* 装饰性的背景编号 */}
                <div className="absolute -top-4 -left-4 text-9xl font-black text-orange-50/50 pointer-events-none group-hover:text-orange-100/50 transition-colors">
                  {index + 1}
                </div>

                {/* 左侧：内容编辑 */}
                <div className="flex-grow space-y-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md">
                      {index + 1}
                    </div>
                    <h3 className="text-xl font-bold text-gray-700">场景 {index + 1}</h3>
                    <div className="flex-grow"></div>
                    <button onClick={() => removeScene(scene.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">画面念白 (显示在绘本中)</label>
                    <textarea 
                      value={scene.storyText}
                      onChange={(e) => updateScene(scene.id, { storyText: e.target.value })}
                      className="w-full p-4 border-2 border-gray-50 rounded-2xl focus:border-orange-200 outline-none resize-none font-medium text-lg bg-gray-50/30"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-blue-400 mb-2 uppercase tracking-wider">AI 画面指令 (包含空间逻辑锁)</label>
                    <textarea 
                      value={scene.imagePrompt}
                      onChange={(e) => updateScene(scene.id, { imagePrompt: e.target.value })}
                      className="w-full p-4 border-2 border-blue-50 rounded-2xl focus:border-blue-200 outline-none text-base bg-blue-50/30 font-mono text-sm"
                      rows={4}
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={() => handleGenerateSingle(scene.id)}
                      disabled={scene.isGenerating}
                      className={`w-full py-4 rounded-2xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-3 ${
                        scene.imageUrl 
                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-200 hover:bg-blue-100' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {scene.isGenerating ? (
                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>{scene.imageUrl ? "🔄 重新生成此画面" : "🎨 生成此画面预览"}</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* 右侧：预览 */}
                <div className="lg:w-[400px] flex-shrink-0 relative z-10">
                   <div className="aspect-square bg-orange-50 rounded-3xl border-4 border-orange-100 shadow-inner overflow-hidden flex items-center justify-center relative">
                     {scene.imageUrl ? (
                       <img src={scene.imageUrl} alt="Preview" className="w-full h-full object-cover animate-fade-in" />
                     ) : (
                       <div className="flex flex-col items-center gap-4 text-orange-200">
                         {scene.isGenerating ? (
                           <div className="flex flex-col items-center gap-4">
                             <div className="w-16 h-16 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin"></div>
                             <p className="font-bold text-orange-500">AI 画师工作中...</p>
                           </div>
                         ) : (
                           <>
                             <div className="text-6xl opacity-30">🖼️</div>
                             <p className="font-medium">等待生成画面</p>
                           </>
                         )}
                       </div>
                     )}
                   </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => addScene(story.scenes.length - 1)}
              className="bg-white border-4 border-dashed border-orange-200 p-8 rounded-3xl text-orange-300 hover:text-orange-500 hover:border-orange-400 transition-all flex flex-col items-center gap-2"
            >
              <span className="text-4xl">+</span>
              <span className="font-bold">添加一个新场景</span>
            </button>
          </div>
        </div>
      )}

      {story && !story.isEditing && (
        <div className="space-y-12 animate-fade-in pb-20">
          <div className="no-print bg-white p-8 rounded-3xl shadow-xl border-4 border-orange-100 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 space-y-6">
                <h3 className="text-2xl font-bold text-orange-700 flex items-center gap-3">
                  <span>🖨️</span> 打印排版预览
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-wide">纸张尺寸</label>
                    <select 
                      value={paperSize} 
                      onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-orange-300 transition-all font-bold"
                    >
                      <option value="A4">A4 (标准尺寸)</option>
                      <option value="A5">A5 (精装口袋本)</option>
                      <option value="Letter">Letter (美国信纸)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-wide">页面布局</label>
                    <select 
                      value={layout} 
                      onChange={(e) => setLayout(e.target.value as LayoutType)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-orange-300 transition-all font-bold"
                    >
                      <option value="one-per-page">每页一图 (大幅)</option>
                      <option value="two-per-page">每页两图 (竖向)</option>
                      <option value="grid">两列网格 (紧凑)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handlePrint}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-5 rounded-2xl font-bold text-2xl shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-4"
                >
                  <span>🖨️</span> 打印绘本
                </button>
                <button 
                  onClick={() => setStory({...story, isEditing: true})}
                  className="text-orange-600 font-bold hover:underline flex items-center justify-center gap-2"
                >
                  <span>←</span> 返回修改分镜
                </button>
              </div>
            </div>
          </div>

          <div id="printable-story" className="space-y-12">
            <div className="text-center">
              <h2 className="text-5xl font-bold text-gray-800 mb-4">{story.title}</h2>
              <div className="w-24 h-2 bg-orange-400 mx-auto rounded-full mb-12"></div>
            </div>

            <div className={`grid gap-12 ${layout === 'grid' ? 'grid-cols-1 md:grid-cols-2' : layout === 'two-per-page' ? 'grid-cols-1' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
              {story.scenes.map((scene, index) => (
                <div key={scene.id} className="relative group">
                   <StoryCard scene={{...scene, id: index + 1}} />
                </div>
              ))}
            </div>

            <div className="moral-section bg-orange-100 p-12 rounded-3xl text-center border-8 border-double border-orange-300 max-w-4xl mx-auto mt-20">
              <h3 className="text-3xl font-bold text-orange-700 mb-6 flex items-center justify-center gap-3">
                 <span>🌟</span> 故事小道理
              </h3>
              <p className="text-2xl text-orange-900 leading-relaxed italic font-bold">"{story.moral}"</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pt-10 gap-4 no-print border-t border-orange-100">
            <p className="text-gray-400 font-medium">绘本制作完成？开始下一个新故事吧</p>
            <button 
              onClick={() => setStory(null)}
              className="bg-white text-orange-600 border-2 border-orange-200 hover:bg-orange-50 px-10 py-4 rounded-2xl font-bold text-lg shadow-md transition-all flex items-center gap-2"
            >
              <span>✨</span> 创作另一个新故事
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xl mx-auto mt-8 bg-red-50 border-4 border-red-100 p-8 rounded-3xl text-center text-red-600 animate-fade-in shadow-xl">
          <p className="font-bold text-xl mb-6">{error}</p>
          <button onClick={() => setError(null)} className="bg-red-500 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-red-600 transition-all">我知道了</button>
        </div>
      )}
    </div>
  );
};

export default App;
