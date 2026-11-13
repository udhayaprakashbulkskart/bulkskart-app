import React from 'react';
import Header from './Header';
import Footer from './Footer';
interface MainLayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export default function MainLayout({ children, hideFooter = false }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-transparent">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden pb-8 md:pb-16">
        <div className="bs-page-enter min-w-0">
          {children}
        </div>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
