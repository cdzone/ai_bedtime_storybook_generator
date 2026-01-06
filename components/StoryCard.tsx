
import React from 'react';
import { Scene } from '../types';

interface StoryCardProps {
  scene: Scene;
}

const StoryCard: React.FC<StoryCardProps> = ({ scene }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!scene.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = scene.imageUrl;
    link.download = `story-scene-${scene.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-lg transform transition duration-500 hover:scale-105 border-4 border-orange-100 h-full flex flex-col group">
      <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {scene.imageUrl ? (
          <>
            <img 
              src={scene.imageUrl} 
              alt={`Scene ${scene.id}`} 
              className="w-full h-full object-cover"
            />
            {/* 悬浮下载按钮 */}
            <button 
              onClick={handleDownload}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-orange-500 hover:text-white text-orange-600 p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 no-print"
              title="下载此图"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 text-orange-300">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">绘制中...</p>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
          {scene.id}
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col justify-center text-center">
        <p className="text-gray-700 text-lg leading-relaxed font-medium">
          {scene.storyText}
        </p>
      </div>
    </div>
  );
};

export default StoryCard;
