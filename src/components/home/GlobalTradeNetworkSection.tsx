import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Globe, Ship, ArrowRight, ChevronRight, MapPin, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Reference routes for display. Distances and transit times are approximate and must be verified before quoting. */
const POPULAR_ROUTES = [
  { from: 'Los Angeles', fromFlag: '🇺🇸', to: 'New York & NJ', toFlag: '🇺🇸', approx: '~ 5,483 km', days: '6–8 Days' },
  { from: 'New York & NJ', fromFlag: '🇺🇸', to: 'Singapore', toFlag: '🇸🇬', approx: '~ 15,349 km', days: '18–22 Days' },
  { from: 'Los Angeles', fromFlag: '🇺🇸', to: 'Shanghai', toFlag: '🇨🇳', approx: '~ 10,473 km', days: '12–16 Days' },
  { from: 'Mumbai', fromFlag: '🇮🇳', to: 'Dubai', toFlag: '🇦🇪', approx: '~ 1,930 km', days: '3–5 Days' },
  { from: 'Chennai', fromFlag: '🇮🇳', to: 'Singapore', toFlag: '🇸🇬', approx: '~ 4,928 km', days: '7–10 Days' },
];

export default function GlobalTradeNetworkSection() {
  const [selectedRegion, setSelectedRegion] = useState('Select Region');

  const regions = [
    'All Regions',
    'Asia-Pacific',
    'Europe & Mediterranean',
    'North America',
    'Indian Ocean'
  ];

  return (
    <section className="relative z-20 max-w-7xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 mb-6 sm:mb-10">
      {/* ── Main Glassmorphism Rounded Container (Exact Reference Style) ── */}
      <div className="relative rounded-3xl bg-[#060B18] border border-[#FF5A00] p-4 sm:p-6 md:p-8 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
        
        {/* Subtle Ambient Glowing Halos */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#C94400] blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-[#FF5A1F]/5 blur-[140px] pointer-events-none rounded-full" />

        {/* ── Header Row: Orange Anchor Icon + Title + Region Dropdown ── */}
        <div className="relative z-10 flex flex-row items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-3.5">
            {/* Orange Harbor/Anchor Glyph Container */}
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-[#FF5A1F]/25 to-[#FF3B00]/10 border border-[#FF5A1F]/35 flex items-center justify-center shrink-0 shadow-lg shadow-[#FF5A1F]/15">
              <Globe className="w-6 h-6 text-[#FF5A1F]" strokeWidth={2} />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Global Trade <span className="text-[#FF5A1F]">Routes</span>
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5">
                Discover major ports, shipping routes and global trade opportunities
              </p>
            </div>
          </div>

          {/* "Select Region" Dropdown Button */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl border border-[#2A2A2A]/80 bg-[#0B1528]/90 hover:bg-[#C94400] text-slate-200 hover:text-white font-medium text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm focus:outline-none"
                >
                  <span>{selectedRegion}</span>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#0B1528] border-[#2A2A2A] text-slate-200 text-xs">
                {regions.map((region) => (
                  <DropdownMenuItem
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className="cursor-pointer hover:bg-[#0A0A0A] hover:text-white flex items-center justify-between py-2"
                  >
                    <span>{region}</span>
                    {selectedRegion === region && <span className="w-1.5 h-1.5 rounded-full bg-[#C94400]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Proportionally Scaled SVG World Map Canvas (Exact to Reference Photo) ── */}
        <div className="trade-map-in relative w-full h-[380px] md:h-auto md:aspect-[1000/540] rounded-2xl bg-[#040813] border border-[#2A2A2A]/80 overflow-x-auto md:overflow-hidden shadow-2xl flex items-center justify-start md:justify-center select-none">

          <svg
            className="w-full h-full block min-w-[720px] md:min-w-0"
            viewBox="0 0 1000 540"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Electric Cyan & Soft Blue Gradients for Routes */}
              <linearGradient id="routeCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.95" />
              </linearGradient>

              {/* Glowing Warm Orange Gradient for India/Asia Corridors */}
              <linearGradient id="routeOrangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF5A1F" stopOpacity="1" />
                <stop offset="100%" stopColor="#FFA040" stopOpacity="0.95" />
              </linearGradient>

              {/* Glowing Filter for Routes */}
              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Soft Beacon Glow Filter for Ports */}
              <filter id="portGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* High Intensity Orange Beacon Glow Filter */}
              <filter id="nhavaGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* In-SVG 60fps Animation Styles */}
            <style>{`
              @keyframes liveRouteFlow {
                from { stroke-dashoffset: 40; }
                to { stroke-dashoffset: 0; }
              }
              .route-dotted-cyan {
                stroke-dasharray: 4 5;
                animation: liveRouteFlow 3.5s linear infinite;
              }
              .route-dotted-orange {
                stroke-dasharray: 5 5;
                animation: liveRouteFlow 3s linear infinite;
              }
              @keyframes pulseRing {
                0% { r: 12px; opacity: 0.8; }
                50% { r: 24px; opacity: 0.1; }
                100% { r: 12px; opacity: 0.8; }
              }
              @keyframes nhavaPulseRing {
                0% { r: 16px; opacity: 0.9; }
                50% { r: 32px; opacity: 0.15; }
                100% { r: 16px; opacity: 0.9; }
              }
              .port-pulse {
                animation: pulseRing 2.8s ease-in-out infinite;
              }
              .nhava-pulse {
                animation: nhavaPulseRing 2.2s ease-in-out infinite;
              }
              @keyframes tradeMapIn {
                from { opacity: 0; transform: scale(0.97); }
                to { opacity: 1; transform: none; }
              }
              @keyframes tradeRowIn {
                from { opacity: 0; transform: translateX(18px); }
                to { opacity: 1; transform: none; }
              }
              .trade-map-in { animation: tradeMapIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
              .trade-row { animation: tradeRowIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; transition: box-shadow 0.3s, border-color 0.3s; }
              .trade-row:hover { box-shadow: 0 0 22px -6px rgba(255, 90, 31, 0.65); }
              @media (prefers-reduced-motion: reduce) {
                .route-dotted-cyan, .route-dotted-orange, .port-pulse, .nhava-pulse, .trade-row, .trade-map-in { animation: none !important; }
              }
            `}</style>

            {/* Light trails travelling along the main routes */}
            {[
              { d: 'M 95,230 Q 170,185 245,220', dur: '5s', begin: '0s' },
              { d: 'M 245,220 Q 365,130 485,185', dur: '6s', begin: '1.6s' },
              { d: 'M 485,185 Q 545,220 575,235 Q 600,250 625,275', dur: '5.5s', begin: '3.2s' },
            ].map((c, i) => (
              <g key={`trail-${i}`}>
                <circle r="6" fill="#00D2FF" fillOpacity="0.22">
                  <animateMotion dur={c.dur} begin={c.begin} repeatCount="indefinite" path={c.d} />
                </circle>
                <circle r="2.8" fill="#E6FBFF" filter="url(#routeGlow)">
                  <animateMotion dur={c.dur} begin={c.begin} repeatCount="indefinite" path={c.d} />
                </circle>
              </g>
            ))}

            {/* ── 1. DOTTED CONTINENTAL LANDMASSES MATRIX ── */}
            {/* North America Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.22">
              {/* Canada & Alaska */}
              {[
                [70,80],[85,75],[100,75],[115,70],[130,70],[145,65],[160,70],[175,70],[190,75],[205,75],
                [80,95],[95,90],[110,90],[125,85],[140,85],[155,80],[170,80],[185,85],[200,90],[215,95],
                [75,110],[90,105],[105,105],[120,100],[135,100],[150,95],[165,95],[180,100],[195,105],[210,110],[225,115],
                [85,125],[100,120],[115,120],[130,115],[145,115],[160,110],[175,110],[190,115],[205,120],[220,125],[235,130],
                [95,140],[110,135],[125,135],[140,130],[155,130],[170,125],[185,125],[200,130],[215,135],[230,140],[245,145],
                // USA Core
                [85,155],[100,150],[115,150],[130,145],[145,145],[160,140],[175,140],[190,145],[205,150],[220,155],[235,160],[250,165],
                [90,170],[105,165],[120,165],[135,160],[150,160],[165,155],[180,155],[195,160],[210,165],[225,170],[240,175],[255,180],
                [95,185],[110,180],[125,180],[140,175],[155,175],[170,170],[185,170],[200,175],[215,180],[230,185],[245,190],[260,195],
                [90,200],[105,195],[120,195],[135,190],[150,190],[165,185],[180,185],[195,190],[210,195],[225,200],[240,205],[255,210],
                [95,215],[110,210],[125,210],[140,205],[155,205],[170,200],[185,200],[200,205],[215,210],[230,215],[245,220],[255,225],
                [100,230],[115,225],[130,225],[145,220],[160,220],[175,215],[190,215],[205,220],[220,225],[235,230],
                [110,245],[125,240],[140,240],[155,235],[170,235],[185,230],[200,235],[215,240],
                // Mexico & Central America
                [125,260],[140,255],[155,255],[170,250],[185,250],[200,255],
                [145,275],[160,270],[175,270],[190,270],
                [165,290],[180,285],[195,285],
                [185,305],[200,300],[210,305]
              ].map(([x, y], i) => (
                <circle key={`na-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* West Coast Orange Dots (Accent as in Reference Photo) */}
            <g fill="#FF5A1F" fillOpacity="0.45">
              {[
                [75,130],[85,145],[80,160],[85,175],[90,190],[85,205],[90,220],[95,235],[105,250],[115,265]
              ].map(([x, y], i) => (
                <circle key={`wco-${i}`} cx={x} cy={y} r="1.8" />
              ))}
            </g>

            {/* South America Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.22">
              {[
                [220,315],[235,310],[250,310],[265,315],[280,320],
                [215,330],[230,325],[245,325],[260,330],[275,335],[290,340],[305,345],
                [225,345],[240,340],[255,340],[270,345],[285,350],[300,355],[315,360],
                [220,360],[235,355],[250,355],[265,360],[280,365],[295,370],[310,375],
                [225,375],[240,370],[255,370],[270,375],[285,380],[300,385],
                [230,390],[245,385],[260,385],[275,390],[290,395],
                [235,405],[250,400],[265,400],[280,405],
                [240,420],[255,415],[270,415],[280,420],
                [245,435],[260,430],[270,435],
                [250,450],[260,445],[265,450],
                [255,465],[260,465]
              ].map(([x, y], i) => (
                <circle key={`sa-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* Europe Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.25">
              {[
                // UK & Scandinavia
                [440,110],[455,105],[470,105],[485,110],
                [450,125],[465,120],[480,120],[495,125],[510,130],[525,130],
                [445,140],[460,135],[475,135],[490,140],[505,140],[520,145],[535,145],
                // Western & Central Europe
                [435,155],[450,150],[465,150],[480,155],[495,155],[510,160],[525,160],[540,165],
                [430,170],[445,165],[460,165],[475,170],[490,170],[505,175],[520,175],[535,180],[550,180],
                // Mediterranean & Southern Europe
                [435,185],[450,180],[465,180],[480,185],[495,185],[510,190],[525,190],[540,195],[555,195]
              ].map(([x, y], i) => (
                <circle key={`eu-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* Africa Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.22">
              {[
                // North Africa
                [440,210],[455,205],[470,205],[485,210],[500,210],[515,215],[530,215],[545,220],[560,220],
                [445,225],[460,220],[475,220],[490,225],[505,225],[520,230],[535,230],[550,235],[565,235],
                [450,240],[465,235],[480,235],[495,240],[510,240],[525,245],[540,245],[555,250],[570,250],
                // Central Africa
                [455,255],[470,250],[485,250],[500,255],[515,255],[530,260],[545,260],[560,265],[575,265],
                [465,270],[480,265],[495,265],[510,270],[525,270],[540,275],[555,275],[570,280],
                [475,285],[490,280],[505,280],[520,285],[535,285],[550,290],[565,290],[580,295],
                [485,300],[500,295],[515,295],[530,300],[545,300],[560,305],[575,305],
                [495,315],[510,310],[525,310],[540,315],[555,315],[570,320],
                // Southern Africa
                [500,330],[515,325],[530,325],[545,330],[560,335],
                [505,345],[520,340],[535,340],[550,345],[565,350],
                [510,360],[525,355],[540,355],[555,360],
                [515,375],[530,370],[545,370],[555,375],
                [520,390],[535,385],[550,390],
                [525,405],[540,405]
              ].map(([x, y], i) => (
                <circle key={`af-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* South Africa Yellow/Orange Accent Dots (as in Reference) */}
            <g fill="#FFB800" fillOpacity="0.45">
              {[
                [520,350],[535,355],[525,370],[540,375],[530,390],[545,395],[535,405]
              ].map(([x, y], i) => (
                <circle key={`sao-${i}`} cx={x} cy={y} r="1.7" />
              ))}
            </g>

            {/* Asia Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.25">
              {[
                // Russia & North Asia
                [560,105],[580,100],[600,100],[620,95],[640,95],[660,95],[680,100],[700,100],[720,95],[740,95],[760,100],[780,100],[800,105],[820,105],[840,110],[860,110],
                [570,120],[590,115],[610,115],[630,110],[650,110],[670,110],[690,115],[710,115],[730,110],[750,110],[770,115],[790,115],[810,120],[830,120],[850,125],[870,125],
                [580,135],[600,130],[620,130],[640,125],[660,125],[680,125],[700,130],[720,130],[740,125],[760,125],[780,130],[800,130],[820,135],[840,135],[860,140],[880,140],
                // Central & East Asia (China)
                [570,150],[590,145],[610,145],[630,140],[650,140],[670,140],[690,145],[710,145],[730,140],[750,140],[770,145],[790,145],[810,150],[830,150],[850,155],[870,155],
                [580,165],[600,160],[620,160],[640,155],[660,155],[680,155],[700,160],[720,160],[740,155],[760,155],[780,160],[800,160],[820,165],[840,165],[860,170],
                [590,180],[610,175],[630,175],[650,170],[670,170],[690,170],[710,175],[730,175],[750,170],[770,170],[790,175],[810,175],[830,180],[850,180],
                // China & East Asia Coast
                [680,190],[700,185],[720,185],[740,185],[760,190],[780,190],[800,195],[820,195],[840,200],
                [690,205],[710,200],[730,200],[750,200],[770,205],[790,205],[810,210],[830,210],[850,215],
                [700,220],[720,215],[740,215],[760,215],[780,220],[800,220],[820,225],[840,225],
                [710,235],[730,230],[750,230],[770,230],[790,235],[810,235],[830,240],
                [720,250],[740,245],[760,245],[780,245],[800,250],[820,250],
                // Southeast Asia & Indonesia archipelago
                [730,265],[750,260],[770,260],[790,265],[810,265],
                [740,280],[760,275],[780,275],[800,280],[820,280],
                [750,295],[770,290],[790,290],[810,295],
                [760,310],[780,305],[800,305],[820,310],[840,315],
                [770,325],[790,320],[810,320],[830,325],
                [780,340],[800,335],[820,335],[840,340],[860,345]
              ].map(([x, y], i) => (
                <circle key={`as-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* India Subcontinent Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.32">
              {[
                [610,195],[625,190],[640,190],[655,195],[670,195],
                [605,210],[620,205],[635,205],[650,210],[665,210],[680,215],
                [610,225],[625,220],[640,220],[655,225],[670,225],[685,230],
                [615,240],[630,235],[645,235],[660,240],[675,240],
                [620,255],[635,250],[650,250],[665,255],[675,255],
                [625,270],[640,265],[655,265],[670,270],
                [630,285],[645,280],[660,280],[670,285],
                [635,300],[650,295],[660,295],
                [640,315],[650,310],[655,315],
                [645,330],[650,330]
              ].map(([x, y], i) => (
                <circle key={`in-${i}`} cx={x} cy={y} r="1.8" />
              ))}
            </g>

            {/* Australia Dotted Cloud */}
            <g fill="#00D2FF" fillOpacity="0.22">
              {[
                [780,360],[795,355],[810,355],[825,360],[840,360],[855,365],
                [775,375],[790,370],[805,370],[820,375],[835,375],[850,380],[865,385],
                [770,390],[785,385],[800,385],[815,390],[830,390],[845,395],[860,400],[875,405],
                [775,405],[790,400],[805,400],[820,405],[835,405],[850,410],[865,415],
                [785,420],[800,415],[815,415],[830,420],[845,420],[860,425],
                [795,435],[810,430],[825,430],[840,435],[855,440],
                [805,450],[820,445],[835,445],[850,450]
              ].map(([x, y], i) => (
                <circle key={`au-${i}`} cx={x} cy={y} r="1.6" />
              ))}
            </g>

            {/* ── 2. GLOWING SHIPPING ROUTES (CYAN & ORANGE) ── */}
            <g filter="url(#routeGlow)">
              {/* Route 1 (Cyan Dotted): Port of Los Angeles (95, 230) -> Port of New York & NJ (245, 220) */}
              <path
                id="routeLAtoNY"
                d="M 95,230 Q 170,185 245,220"
                fill="none"
                stroke="url(#routeCyanGrad)"
                strokeWidth="2.4"
                className="route-dotted-cyan"
              />

              {/* Route 2 (Cyan Dotted): Port of New York & NJ (245, 220) -> Port of Rotterdam (485, 185) */}
              <path
                id="routeNYtoRotterdam"
                d="M 245,220 Q 365,130 485,185"
                fill="none"
                stroke="url(#routeCyanGrad)"
                strokeWidth="2.4"
                className="route-dotted-cyan"
              />

              {/* Route 3 (Cyan Dotted): Port of Rotterdam (485, 185) -> Mediterranean/Suez -> Nhava Sheva (625, 275) */}
              <path
                id="routeRotterdamToNhava"
                d="M 485,185 Q 545,220 575,235 Q 600,250 625,275"
                fill="none"
                stroke="url(#routeCyanGrad)"
                strokeWidth="2.4"
                className="route-dotted-cyan"
              />

              {/* Route 4 (Orange Glowing Dotted): Nhava Sheva (625, 275) -> Ningbo Zhoushan & Shanghai (755, 240) */}
              <path
                id="routeNhavaToNingbo"
                d="M 625,275 Q 675,225 755,240"
                fill="none"
                stroke="url(#routeOrangeGrad)"
                strokeWidth="2.8"
                className="route-dotted-orange"
              />

              {/* Route 5 (Orange Glowing Dotted): Nhava Sheva (625, 275) -> PSA Singapore (795, 350) */}
              <path
                id="routeNhavaToSingapore"
                d="M 625,275 Q 710,310 795,350"
                fill="none"
                stroke="url(#routeOrangeGrad)"
                strokeWidth="2.8"
                className="route-dotted-orange"
              />

              {/* Route 6 (Cyan Dotted): Chennai Port (625, 370) -> PSA Singapore (795, 350) */}
              <path
                id="routeChennaiToSingapore"
                d="M 625,370 Q 710,360 795,350"
                fill="none"
                stroke="url(#routeCyanGrad)"
                strokeWidth="2.4"
                className="route-dotted-cyan"
              />

              {/* Route 7 (Cyan Dotted Long Transpacific Arc): PSA Singapore (795, 350) looping down and sweeping west to Port of Los Angeles (95, 230) */}
              <path
                id="routeSouthernTranspacific"
                d="M 795,350 Q 730,430 650,425 Q 450,410 280,360 Q 150,320 95,230"
                fill="none"
                stroke="url(#routeCyanGrad)"
                strokeWidth="2.4"
                className="route-dotted-cyan"
              />
            </g>

            {/* ── 3. ANIMATED CARGO SHIP ICONS TRAVELING ALONG ROUTES ── */}
            {/* Cargo Ship 1: Traveling along the Southern Transpacific Route */}
            <g filter="url(#routeGlow)">
              <g>
                <path
                  d="M -11,-2 L 7,-2 L 11,2 L 7,6 L -11,6 Z M -6,-7 L 3,-7 L 3,-2 L -6,-2 Z"
                  fill="#FF5A1F"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <animateMotion
                  dur="16s"
                  repeatCount="indefinite"
                  rotate="auto"
                  keyPoints="0;1"
                  keyTimes="0;1"
                >
                  <mpath href="#routeSouthernTranspacific" />
                </animateMotion>
              </g>
            </g>

            {/* Cargo Ship 2: Traveling between New York & Rotterdam */}
            <g filter="url(#routeGlow)">
              <g>
                <path
                  d="M -10,-2 L 6,-2 L 10,2 L 6,6 L -10,6 Z M -5,-6 L 2,-6 L 2,-2 L -5,-2 Z"
                  fill="#FF5A1F"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <animateMotion
                  dur="12s"
                  repeatCount="indefinite"
                  rotate="auto"
                  keyPoints="0;1"
                  keyTimes="0;1"
                >
                  <mpath href="#routeNYtoRotterdam" />
                </animateMotion>
              </g>
            </g>

            {/* Cargo Ship 3: Traveling between Nhava Sheva & PSA Singapore */}
            <g filter="url(#routeGlow)">
              <g>
                <path
                  d="M -10,-2 L 6,-2 L 10,2 L 6,6 L -10,6 Z M -5,-6 L 2,-6 L 2,-2 L -5,-2 Z"
                  fill="#FF5A1F"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <animateMotion
                  dur="9s"
                  repeatCount="indefinite"
                  rotate="auto"
                  keyPoints="0;1"
                  keyTimes="0;1"
                >
                  <mpath href="#routeNhavaToSingapore" />
                </animateMotion>
              </g>
            </g>

            {/* Cargo Ship 4: Traveling between Nhava Sheva & Ningbo Zhoushan */}
            <g filter="url(#routeGlow)">
              <g>
                <path
                  d="M -10,-2 L 6,-2 L 10,2 L 6,6 L -10,6 Z M -5,-6 L 2,-6 L 2,-2 L -5,-2 Z"
                  fill="#FF5A1F"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <animateMotion
                  dur="11s"
                  repeatCount="indefinite"
                  rotate="auto"
                  keyPoints="0;1"
                  keyTimes="0;1"
                >
                  <mpath href="#routeNhavaToNingbo" />
                </animateMotion>
              </g>
            </g>

            {/* ── 4. PORT MARKERS & LABELS (EXACT REFERENCE POSITIONS & STYLES) ── */}

            {/* PORT 1: Port of Los Angeles (95, 230) */}
            <g id="portLA">
              {/* Outer Subtle Pulse */}
              <circle cx="95" cy="230" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="95" cy="230" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="95" cy="230" r="4" fill="#FFFFFF" />
              {/* Label Pill: "Port of Los Angeles" */}
              <g transform="translate(112, 217)">
                <rect width="118" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  Port of Los Angeles
                </text>
              </g>
            </g>

            {/* PORT 2: Port of New York & NJ (245, 220) */}
            <g id="portNY">
              {/* Outer Subtle Pulse */}
              <circle cx="245" cy="220" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="245" cy="220" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="245" cy="220" r="4" fill="#FFFFFF" />
              {/* Label Pill: "Port of New York & NJ" */}
              <g transform="translate(262, 207)">
                <rect width="130" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  Port of New York &amp; NJ
                </text>
              </g>
            </g>

            {/* PORT 3: Port of Rotterdam (485, 185) */}
            <g id="portRotterdam">
              {/* Outer Subtle Pulse */}
              <circle cx="485" cy="185" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="485" cy="185" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="485" cy="185" r="4" fill="#FFFFFF" />
              {/* Label Pill: "Port of Rotterdam" */}
              <g transform="translate(502, 172)">
                <rect width="114" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  Port of Rotterdam
                </text>
              </g>
            </g>

            {/* PORT 4: Ningbo Zhoushan & Shanghai (755, 240) */}
            <g id="portNingbo">
              {/* Outer Subtle Pulse */}
              <circle cx="755" cy="240" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="755" cy="240" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="755" cy="240" r="4" fill="#FFFFFF" />
              {/* Label Pill: "Ningbo Zhoushan & Shanghai" */}
              <g transform="translate(772, 227)">
                <rect width="170" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  Ningbo Zhoushan &amp; Shanghai
                </text>
              </g>
            </g>

            {/* PORT 5: Chennai Port (625, 370) */}
            <g id="portChennai">
              {/* Outer Subtle Pulse */}
              <circle cx="625" cy="370" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="625" cy="370" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="625" cy="370" r="4" fill="#FFFFFF" />
              {/* Label Pill: "Chennai Port" */}
              <g transform="translate(642, 357)">
                <rect width="90" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  Chennai Port
                </text>
              </g>
            </g>

            {/* PORT 6: PSA Singapore (795, 350) */}
            <g id="portSingapore">
              {/* Outer Subtle Pulse */}
              <circle cx="795" cy="350" r="14" fill="#00D2FF" fillOpacity="0.25" className="port-pulse" />
              {/* Blue Beacon Pin */}
              <circle cx="795" cy="350" r="11" fill="#0077FF" stroke="#00D2FF" strokeWidth="2.5" filter="url(#portGlow)" />
              <circle cx="795" cy="350" r="4" fill="#FFFFFF" />
              {/* Label Pill: "PSA Singapore" */}
              <g transform="translate(812, 337)">
                <rect width="102" height="26" rx="6" fill="#061229" fillOpacity="0.9" stroke="#1E3A5F" strokeWidth="1" />
                <text x="10" y="17" fill="#FFFFFF" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                  PSA Singapore
                </text>
              </g>
            </g>

            {/* PORT 7: NHAVA SHEVA (MUMBAI) - HIGHLIGHTED PRIMARY ORANGE GATEWAY */}
            <g id="portNhavaSheva">
              {/* Outer Strong Orange Pulse Rings */}
              <circle cx="625" cy="275" r="22" fill="#FF5A1F" fillOpacity="0.35" className="nhava-pulse" />
              <circle cx="625" cy="275" r="15" fill="#FF5A1F" fillOpacity="0.4" filter="url(#nhavaGlow)" />

              {/* Teardrop / Circular Orange Location Beacon */}
              <circle cx="625" cy="275" r="14" fill="#FF5A1F" stroke="#FFFFFF" strokeWidth="2.2" filter="url(#nhavaGlow)" />
              {/* Inner White Target Pin Icon */}
              <circle cx="625" cy="275" r="6" fill="#FFFFFF" />
              <circle cx="625" cy="275" r="3" fill="#FF5A1F" />

              {/* Highlighted Orange Capsule Badge Pill: "Nhava Sheva (Mumbai)" */}
              <g transform="translate(525, 305)">
                {/* Glowing Orange Pill Background with Drop Shadow */}
                <rect
                  width="186"
                  height="34"
                  rx="10"
                  fill="#FF5A1F"
                  stroke="#FFA040"
                  strokeWidth="1.5"
                  filter="url(#nhavaGlow)"
                />
                <text
                  x="93"
                  y="22"
                  fill="#FFFFFF"
                  fontSize="13"
                  fontWeight="800"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  letterSpacing="0.3"
                >
                  Nhava Sheva (Mumbai)
                </text>
              </g>
            </g>

          </svg>
        </div>

        {/* Popular trade routes panel */}
        <aside className="flex flex-col rounded-2xl border border-[#2A2A2A]/80 bg-[#0a1222]/90 p-4 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5A1F]/15">
              <Ship className="h-5 w-5 text-[#FF5A1F]" />
            </span>
            <h3 className="text-[16px] font-black text-white">Popular Trade Routes</h3>
          </div>
          <div className="space-y-2.5">
            {POPULAR_ROUTES.map((r, i) => (
              <div key={`${r.from}-${r.to}`} className="trade-row flex items-center justify-between gap-2 rounded-xl border border-[#2A2A2A] bg-[#0c1526] px-3 py-2.5 hover:border-[#FF5A1F]/60" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                    <span className="truncate">{r.fromFlag} {r.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#FF5A1F]" />
                    <span className="truncate">{r.toFlag} {r.to}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-400">{r.approx} <span className="text-neutral-300">|</span> {r.days}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#FF5A1F]" />
              </div>
            ))}
          </div>
          <Link
            to="/products"
            className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-[#FF5A1F]/60 text-[13px] font-bold text-[#FF7A2E] transition-colors hover:bg-[#B33D00]/10"
          >
            View All Trade Routes <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[10px] leading-snug text-neutral-400">Distances and transit times are approximate reference values.</p>
        </aside>
        </div>

        {/* ── Bottom Map Legend (Exact from Reference Photo) ── */}
        <div className="flex flex-wrap items-center justify-start gap-6 sm:gap-10 pt-4 px-2 text-xs text-slate-300 select-none">
          {/* Major Ports Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#C94400] shadow-[0_0_10px_rgba(255,90,31,0.9)] ring-2 ring-[#FF5A1F]/30" />
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">
              Major Ports
            </span>
          </div>

          {/* Shipping Routes Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 font-mono text-[#00D2FF]">
              <span className="w-2.5 h-0.5 bg-[#C94400] inline-block shadow-[0_0_6px_#00D2FF]" />
              <span className="w-1 h-0.5 bg-[#C94400] inline-block shadow-[0_0_6px_#00D2FF]" />
              <span className="w-2.5 h-0.5 bg-[#C94400] inline-block shadow-[0_0_6px_#00D2FF]" />
            </span>
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">
              Shipping Routes
            </span>
          </div>

          {/* Cargo Movement Indicator */}
          <div className="flex items-center gap-2.5">
            <svg
              className="w-5 h-5 text-[#FF5A1F] shrink-0 fill-[#FF5A1F] drop-shadow-[0_0_6px_rgba(255,90,31,0.8)]"
              viewBox="0 0 24 24"
            >
              <path d="M2 13h15l4 4h-19z" />
              <path d="M5 9h8v3h-8z" />
              <path d="M7 6h3v2h-3z" />
            </svg>
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">
              Cargo Movement
            </span>
          </div>

          {/* Trade Hub Indicator */}
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 shrink-0 text-[#FF5A1F] drop-shadow-[0_0_6px_rgba(255,90,31,0.8)]" />
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">Trade Hub</span>
          </div>

          {/* Active Route Indicator */}
          <div className="flex items-center gap-2.5">
            <Circle className="h-5 w-5 shrink-0 text-[#00D2FF] drop-shadow-[0_0_6px_rgba(0,210,255,0.8)]" />
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">Active Route</span>
          </div>
        </div>

      </div>
    </section>
  );
}
