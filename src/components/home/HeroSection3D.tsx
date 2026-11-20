import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DesktopHomeHero from '@/components/home/desktop/DesktopHomeHero';
import MobileHomeHero from '@/components/home/mobile/MobileHomeHero';
import type { HomeSearchType } from '@/components/home/shared/parts';
import { MOBILE_QUERY, useMediaQuery } from '@/hooks/use-media-query';

interface HeroSection3DProps {
  onSearch?: (query: string, category: string) => void;
}

const POPULAR_CATEGORIES = [
  { name: 'Textile', query: 'cotton fabric yarn' },
  { name: 'Steel', query: 'steel pipe rebar sheet' },
  { name: 'Chemical', query: 'polymers dyes industrial' },
  { name: 'Plastic', query: 'granules polymer hdpe' },
  { name: 'Machinery', query: 'generator motor equipment' },
  { name: 'Agriculture', query: 'spices grains coffee' },
  { name: 'Packaging', query: 'corrugated boxes cartons' },
  { name: 'Electrical', query: 'cables transformers switchgear' },
];

export default function HeroSection3D({ onSearch }: HeroSection3DProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<HomeSearchType>('products');
  const isPhone = useMediaQuery(MOBILE_QUERY);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      if (selectedType === 'manufacturers') navigate('/manufacturers');
      else if (selectedType === 'rfqs') navigate('/auctions/reverse');
      else navigate('/products');
      return;
    }

    if (onSearch) {
      onSearch(searchQuery, selectedType);
    }

    if (selectedType === 'manufacturers') {
      navigate(`/manufacturers?q=${encodeURIComponent(searchQuery.trim())}`);
    } else if (selectedType === 'rfqs') {
      navigate(`/auctions/reverse?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleQuickTagClick = (tagQuery: string) => {
    navigate(`/products?q=${encodeURIComponent(tagQuery)}`);
  };

  // One design, two layouts: the phone screen (under 768px wide) and the wide-screen version.
  const Hero = isPhone ? MobileHomeHero : DesktopHomeHero;
  return (
    <Hero
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      selectedType={selectedType}
      onSelectedTypeChange={setSelectedType}
      onSubmit={handleSearchSubmit}
      popular={POPULAR_CATEGORIES}
      onQuickTag={handleQuickTagClick}
    />
  );
}
