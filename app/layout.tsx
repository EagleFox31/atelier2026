import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { APP_ICON } from "@/lib/app-icon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/auth-context";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PwaInstallProvider } from "@/components/pwa/pwa-install-context";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: 'Atelier Maître | Gestion Automobile',
  description: 'Système de gestion d\'atelier automobile moderne et intuitif.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atelier Maître',
  },
  applicationName: 'Atelier Maître',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: APP_ICON.themeColor,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="fr" className={cn("antialiased", geist.variable, geistMono.variable)}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <PwaInstallProvider>
            <TooltipProvider>
              <AppLayout>
                {children}
              </AppLayout>
              <Toaster position="top-right" richColors />
              <PwaRegister />
            </TooltipProvider>
          </PwaInstallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
