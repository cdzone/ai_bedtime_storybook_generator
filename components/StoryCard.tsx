
import React from 'react';
import { Scene } from '../types';

interface StoryCardProps {
  scene: Scene;
}

const StoryCard: React.FC<StoryCardProps> = ({ scene }) => {
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-lg transform transition duration-500 hover:scale-105 border-4 border-orange-100 h-full flex flex-col">
      <div className="relative aspect-square bg-gray-100 flex items-center justify-center">
        {scene.imageUrl ? (
          <img 
            src={scene.imageUrl} 
            alt={`Scene ${scene.id}`} 
            className="w-full h-full object-cover"
          />
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
