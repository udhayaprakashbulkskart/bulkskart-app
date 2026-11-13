import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Factory, Gavel, Sparkles, ChevronRight,
  ShieldCheck, Globe, Flame, Users, CheckCircle2, Box
} from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';

interface TiltCardState {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
}

export default function MarketplaceActionCards3D() {
  const navigate = useNavigate();

  const cards = [
    {
      id: 1,
      title: 'Post Your Requirement',
      description: 'Create custom RFQs and broadcast specs to verified factories.',
      badgeIcon: FileText,
      path: '/post-requirement',
      image: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg', // Warehouse logistics
    },
    {
      id: 2,
      title: 'Manufacturers Directory',
      description: 'Discover and connect with verified manufacturing plants.',
      badgeIcon: Factory,
      path: '/manufacturers',
      image: 'https://cdn.pixabay.com/photo/2016/09/12/07/48/mechanical-1663275_1280.jpg', // Industrial processing factory
    },
    {
      id: 3,
      title: 'Live Reverse Auctions',
      description: 'Real-time supplier price bidding for bulk contract awards.',
      badgeIcon: Gavel,
      path: '/auctions/reverse',
      image: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg', // Gavel & live trading
    },
    {
      id: 4,
      title: 'AI Sourcing Assistant',
      description: 'Intelligent factory matching & technical specification analysis.',
      badgeIcon: Box,
      path: '/trade-assistant?tab=sourcing',
      image: 'https://cdn.pixabay.com/photo/2020/03/31/13/26/processor-4987614_1280.jpg', // Advanced smart industrial manufacturing
    },
    {
      id: 5,
      title: 'AI Import & Export Assistant',
      description: 'Tariffs, HS codes, landed cost calculation & shipping docs.',
      badgeIcon: Sparkles,
      path: '/trade-assistant?tab=calculator',
      image: 'https://cdn.pixabay.com/photo/2017/04/02/09/08/bulldozer-2195329_1280.jpg', // Global shipping container vessel
    }
  ];

  return (
    <section className="relative z-20 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 mt-1.5 sm:mt-3 mb-6 sm:mb-10">
      {/* 2-Column Grid on Mobile (360px-430px) & 5-Column on Desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {cards.map((card) => {
          const BadgeIcon = card.badgeIcon;

          return (
            <div
              key={card.id}
              onClick={() => navigate(card.path)}
              className="group relative min-h-[160px] sm:min-h-[175px] h-auto rounded-2xl overflow-hidden border border-[#2A2A2A]/90 bg-[#0A0A0A]/95 shadow-md hover:shadow-xl hover:border-[#FF5A00]/70 cursor-pointer transition-all duration-300 flex flex-col justify-between p-3 sm:p-3.5 active:scale-[0.98] w-full"
            >
              {/* Background Industrial Image with Dark Gradient Overlays */}
              <div className="absolute inset-0 z-0">
                <SafeImage
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover opacity-35 group-hover:opacity-45 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/85 to-[#0B0F17]/50" />
              </div>

              {/* Top Row: Feature Icon in Orange Rounded Square */}
              <div className="relative z-10 flex items-start justify-between">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#C94400] text-white flex items-center justify-center shadow-md shadow-orange-950/40 group-hover:scale-105 transition-transform duration-200 shrink-0">
                  <BadgeIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>

              {/* Bottom Row: Title & Description on left, Small Circular Orange Arrow Button on right */}
              <div className="relative z-10 flex items-end justify-between gap-1.5 mt-auto pt-2 w-full">
                <div className="min-w-0 flex-1 pr-1">
                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FF5A00] transition-colors leading-tight line-clamp-2 break-words">
                    {card.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 font-normal line-clamp-2 mt-0.5 leading-snug break-words">
                    {card.description}
                  </p>
                </div>

                {/* Small Circular Orange Arrow Button at Bottom Right */}
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#C94400] group-hover:bg-[#B33D00] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:translate-x-0.5">
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
