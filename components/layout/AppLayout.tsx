'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar, MobileSidebar, BottomNav } from './Sidebar';
import { motion, AnimatePresence } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, LogOut, Menu } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CommandPalette } from './CommandPalette';
import { useAuth } from '@/contexts/auth-context';
import { authApi } from '@/lib/api';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { GuideMenu } from '@/components/onboarding/GuideMenu';
import { GettingStartedNav } from '@/components/onboarding/GettingStartedNav';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { Loader } from '@/components/ui/loader';

const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/demo', '/inscription'];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isAuthenticated, isLoading, user, logout, updateUser } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Pages d'impression / PDF : pas de chrome applicatif
  const isPrintRoute = pathname.includes('/print');

  // Redirection si non authentifié
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Onboarding : une fois par compte (persisté en BDD sur le profil utilisateur)
  useEffect(() => {
    if (!user) return;
    setShowOnboarding(!user.onboardingCompletedAt);
  }, [user]);

  async function closeOnboarding() {
    setShowOnboarding(false);
    try {
      const { onboardingCompletedAt } = await authApi.completeOnboarding();
      updateUser({ onboardingCompletedAt });
    } catch {
      toast.error('Impossible d\'enregistrer la fin de l\'introduction');
    }
  }

  // Page publique (login) : pas de layout
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Page génération PDF : contenu seul (auth requise)
  if (isPrintRoute) {
    if (isLoading || !isAuthenticated) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <Loader size="sm" showText={false} />
        </div>
      );
    }
    return <>{children}</>;
  }

  // Chargement initial
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '?';

  async function handleLogout() {
    await logout();
    toast.success('Déconnecté');
    router.replace('/');
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {showOnboarding && <OnboardingModal onDone={closeOnboarding} />}
      <Sidebar />
      <CommandPalette />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 h-16 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur border-b border-border flex items-center justify-between px-4 md:px-8 shrink-0 z-[101]">
          <div className="flex items-center gap-2 md:gap-4 flex-1 max-w-xl">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetContent
                side="left"
                className="flex h-full max-h-[100dvh] w-[280px] flex-col gap-0 overflow-hidden p-0 bg-sidebar-bg border-none"
              >
                <MobileSidebar onClose={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="relative w-full group" data-tour="tour-header-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-brand transition-colors" size={18} />
              <Input 
                placeholder="Rechercher un véhicule, client, OT... (⌘K)" 
                className="pl-10 h-10 bg-muted border-border rounded-xl focus-visible:ring-brand focus-visible:bg-card transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-500">Atelier ouvert</span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <GettingStartedNav />
              <div data-tour="tour-header-guide">
                <GuideMenu />
              </div>
              <div data-tour="tour-header-notifications">
                <NotificationBell />
              </div>
              
              <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold shadow-lg shadow-brand/20 cursor-pointer hover:ring-2 hover:ring-brand/50 transition-all text-xs">
                {initials}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full"
                onClick={handleLogout}
                title="Se déconnecter"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Bottom Navigation for Mobile */}
      <BottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />

      {/* Bouton support WhatsApp flottant */}
      <a
        href="https://wa.me/237690777859?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20avec%20Atelier%20Ma%C3%AEtre"
        target="_blank"
        rel="noopener noreferrer"
        title="Contacter le support sur WhatsApp"
        className="fixed bottom-20 right-4 z-[110] flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/30 transition-all duration-200 hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/40 md:bottom-6"
        aria-label="Support WhatsApp"
      >
        {/* WhatsApp SVG icon */}
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}

