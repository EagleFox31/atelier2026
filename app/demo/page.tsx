import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { DemoRequestForm } from '@/components/marketing/DemoRequestForm';

export default function DemoPage() {
  return (
    <div className="landing-page min-h-screen bg-gradient-to-b from-[#eef4fa] via-[#f1f5f9] to-white">
      <header className="border-b border-slate-200/70 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
              <Wrench className="text-brand" size={18} />
            </div>
            <span className="font-bold text-slate-800">Atelier Maître</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            Connexion
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14">
        <DemoRequestForm />
      </main>
    </div>
  );
}
