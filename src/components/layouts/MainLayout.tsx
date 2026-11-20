import React from 'react';
import Header from './Header';
import Footer from './Footer';
import MobileHomeNav from '@/components/home/mobile/MobileHomeNav';
interface MainLayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  /** Shows the five-button bar at the bottom of the phone screen (home page only). */
  mobileHomeNav?: boolean;
}

export default function MainLayout({ children, hideFooter = false, mobileHomeNav = false }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
      <Header />
      <main className="flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden pb-12 sm:pb-16 md:pb-20">
        {children}
      </main>
      {!hideFooter && <Footer />}
      {mobileHomeNav && <MobileHomeNav />}
    </div>
  );
}
