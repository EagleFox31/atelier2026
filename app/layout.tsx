import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/auth-context";
import { PwaRegister } from "@/components/pwa/PwaRegister";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: 'Atelier 2026 | Gestion Automobile',
  description: 'Système de gestion d\'atelier automobile moderne et intuitif.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atelier 2026',
  },
  applicationName: 'Atelier 2026',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1D6FA4',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="fr" className={cn("antialiased", geist.variable, geistMono.variable)}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <TooltipProvider>
            <AppLayout>
              {children}
            </AppLayout>
            <Toaster position="top-right" richColors />
            <PwaRegister />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
