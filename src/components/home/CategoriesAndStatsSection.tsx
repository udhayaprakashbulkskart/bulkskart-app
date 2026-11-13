import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers, Package, Factory, Cog, FlaskConical, Shirt,
  ChevronRight, ArrowRight
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  count: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBadgeStyle: string;
  query: string;
  categorySlug: string;
  img: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-textiles',
    name: 'Textiles & Knitted Fabrics',
    count: '12,400+ Products',
    description: 'Fabrics, yarns, woven rolls, cotton and apparel',
    icon: Shirt,
    iconBadgeStyle: 'bg-[#C94400] border-[#FF5A00]/40 text-[#FF5A00]',
    query: 'textiles fabric cotton',
    categorySlug: 'textiles-apparel',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b2662490-e089-46e1-9fab-c6fb86d378a0.jpg',
  },
  {
    id: 'cat-steel',
    name: 'Steel & Structural Metals',
    count: '8,900+ Products',
    description: 'Steel beams, pipes, hollow tubes, rebar and structures',
    icon: Factory,
    iconBadgeStyle: 'bg-[#1b1c25] border-orange-500/40 text-orange-400',
    query: 'steel pipe rebar',
    categorySlug: 'construction-building',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_54c924bf-b297-4865-bab0-5a1ff17d5d1d.jpg',
  },
  {
    id: 'cat-machinery',
    name: 'Industrial Machinery & Equipment',
    count: '6,200+ Products',
    description: 'Electric motors, industrial pumps, machinery & tools',
    icon: Cog,
    iconBadgeStyle: 'bg-[#C94400] border-[#FF5A00]/40 text-[#FF7A2E]',
    query: 'machinery generator motor',
    categorySlug: 'machinery-industrial',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_a32b8102-74a7-48dd-90fe-2dda0bf1ff43.jpg',
  },
  {
    id: 'cat-polymers',
    name: 'Polymers & Plastic Raw Materials',
    count: '5,800+ Products',
    description: 'Virgin polymers, resins, HDPE, LDPE and plastic pellets',
    icon: Layers,
    iconBadgeStyle: 'bg-[#C94400] border-[#FF5A00]/40 text-[#FF7A2E]',
    query: 'plastic granules hdpe',
    categorySlug: 'chemicals-raw-materials',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_5b6610fe-9767-454b-8aba-d2c002b0de04.jpg',
  },
  {
    id: 'cat-chemicals',
    name: 'Chemicals & Solvents',
    count: '4,100+ Products',
    description: 'Industrial solvents, reagents, acids and specialty chemicals',
    icon: FlaskConical,
    iconBadgeStyle: 'bg-[#C94400] border-[#FF5A00]/40 text-[#FF7A2E]',
    query: 'chemical industrial',
    categorySlug: 'chemicals-raw-materials',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_c9e63855-7bd4-49c5-8a93-a95bc5a59714.jpg',
  },
  {
    id: 'cat-packaging',
    name: 'Corrugated Packaging',
    count: '7,300+ Products',
    description: 'Kraft boxes, corrugated cartons, shipping crates & rolls',
    icon: Package,
    iconBadgeStyle: 'bg-[#241810] border-orange-500/40 text-orange-400',
    query: 'packaging box carton',
    categorySlug: 'packaging',
    img: 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_c28a0ced-2f8b-4e2c-bdd1-300fa581dc34.jpg',
  },
];

export default function CategoriesAndStatsSection() {
  return (
    <section className="relative z-20 max-w-[1400px] mx-auto w-full px-4 sm:px-5 md:px-6 pt-3 sm:pt-4 mb-6 sm:mb-10 overflow-hidden rounded-3xl scroll-mt-20">
      
      {/* ── Ambient Industrial Port Background (Top-Right) matching Image 2 ── */}
      <div className="absolute right-0 top-0 w-full sm:w-[58%] md:w-[48%] h-[200px] sm:h-[260px] pointer-events-none select-none overflow-hidden z-0 opacity-80 sm:opacity-90">
        <img
          src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_8968ecea-7c21-468b-a30c-31275c92e5cc.jpg"
          alt="Industrial Sourcing Port & Container Shipping"
          width={960}
          height={540}
          className="w-full h-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
        {/* Gradients blending into the dark section background */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080C14] via-[#080C14]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080C14]/70 via-transparent to-transparent" />
      </div>

      {/* ── Section Header (Exact Reference UI matching Image 2) ── */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 pt-1">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-[#FF5A00] uppercase tracking-wider block mb-0.5">
            CORE INDUSTRIAL TAXONOMY
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Explore Bulk Product{' '}
            <span className="text-[#FF5A00]">
              Categories
            </span>
          </h2>
          <p className="text-xs text-slate-300 mt-0.5 max-w-xl font-normal leading-normal">
            Source directly from verified manufacturers across multiple industries
          </p>
        </div>

        {/* Solid Orange Pill Button matching Image 2 */}
        <Link
          to="/categories"
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-[#C94400] to-[#FF4500] hover:from-[#ff6b1a] hover:to-[#e04500] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#FF5A00]/25 hover:shadow-[#FF5A00]/40 transition-all active:scale-95 shrink-0"
        >
          <span>View All Categories</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── 2-Column Mobile Grid & 3-Column Desktop Grid matching Image 2 ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5 lg:gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.id}
              to={`/products?category=${cat.categorySlug}`}
              className="relative overflow-hidden rounded-2xl bg-[#0c121e]/90 hover:bg-[#1A0C05] border border-[#2A2A2A]/90 hover:border-[#2A2A2A]/90 transition-all duration-300 flex flex-col justify-between group p-3 sm:p-3.5 shadow-lg hover:-translate-y-0.5 active:scale-[0.98] min-h-[120px] sm:min-h-[135px] md:min-h-[145px]"
            >
              {/* Category Icon Badge (Top-Left) */}
              <div className="relative z-10 flex items-center justify-between w-full mb-1.5 sm:mb-2">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border ${cat.iconBadgeStyle} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner`}>
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>

              {/* Title & Product Count (Left Side, Full Text without truncation) */}
              <div className="relative z-10 pt-1 flex-1 flex flex-col justify-end max-w-[62%] sm:max-w-[65%]">
                <h3 className="font-extrabold text-white text-xs sm:text-[13.5px] md:text-sm leading-tight group-hover:text-[#FF5A00] transition-colors break-words">
                  {cat.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#FF5A00] font-bold mt-1 sm:mt-1.5 whitespace-nowrap">
                  {cat.count}
                </p>
              </div>

              {/* Authentic Commodity Photography (Right Half) seamlessly blending into card */}
              <div className="absolute right-0 top-0 bottom-0 w-[52%] sm:w-[50%] pointer-events-none overflow-hidden rounded-r-2xl">
                <img
                  src={cat.img}
                  alt={cat.name}
                  width={640}
                  height={480}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  loading="lazy"
                  decoding="async"
                />
                {/* Seamless ambient blend gradients */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c121e] via-[#0c121e]/70 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c121e]/60 via-transparent to-transparent" />
              </div>

              {/* Circular Chevron Button (Floating over Right Side) matching Image 2 */}
              <div className="absolute right-2.5 sm:right-3 bottom-2.5 sm:bottom-3 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#0A0A0A]/80 border border-[#2A2A2A]/80 text-white group-hover:bg-[#C94400] group-hover:border-[#FF5A00] flex items-center justify-center shrink-0 transition-all shadow-md group-hover:scale-105">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          );
        })}
      </div>

    </section>
  );
}
