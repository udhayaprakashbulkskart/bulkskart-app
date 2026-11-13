import React from 'react';
import Header from './Header';
import Footer from './Footer';
import './black-page.css';
interface MainLayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  /** 'black' paints the whole page, sections and footer solid black (used on the homepage). */
  background?: 'default' | 'black';
}

export default function MainLayout({ children, hideFooter = false, background = 'default' }: MainLayoutProps) {
  const black = background === 'black';
  return (
    <div className={`flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden ${black ? 'bs-black-page bg-black' : 'bg-background'}`}>
      <Header />
      <main className="flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden pb-12 sm:pb-16 md:pb-20">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
