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
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { Loader } from '@/components/ui/loader';

const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/demo'];

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
              <SheetContent side="left" className="p-0 w-[280px] bg-sidebar-bg border-none">
                <MobileSidebar onClose={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="relative w-full group">
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
            
            <div className="flex items-center gap-3">
              <NotificationBell />
              
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
    </div>
  );
}

