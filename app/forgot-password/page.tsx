'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { handleApiError } from '@/lib/api';
import { toast } from 'sonner'; // Still needed for toast.success

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier) return;

    setLoading(true);
    try {
      // Pour une application locale/interne, on simule une requête ou on appelle un endpoint si existant.
      // Comme aucun endpoint backend de réinitialisation n'est présent, on simule un envoi réussi.
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Demande de réinitialisation envoyée !');
      setSubmitted(true);
    } catch (err: unknown) {
      handleApiError(err, 'Une erreur est survenue lors de l\'envoi de la demande.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
            <Wrench className="text-white" size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Atelier Maître</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestion d&apos;atelier automobile</p>
          </div>
        </div>

        {/* Formulaire / Message de succès */}
        <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl">
          {!submitted ? (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-foreground">Mot de passe oublié ?</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Entrez votre email ou votre code employé pour réinitialiser votre mot de passe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Email ou code employé
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Ex: admin@atelier.cm ou EMP-001"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        className="h-10 bg-muted border-border focus-visible:ring-brand pl-10"
                        disabled={loading}
                        required
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg shadow-md shadow-brand/20 transition-all duration-200"
                    disabled={loading || !identifier}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Envoi en cours...
                      </>
                    ) : (
                      'Envoyer la demande'
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                    >
                      <ArrowLeft size={14} />
                      Retour à la connexion
                    </Link>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <CheckCircle2 className="text-green-500" size={24} />
                </div>
                <CardTitle className="text-lg font-bold text-foreground">Demande reçue</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Si le compte existe, les instructions de réinitialisation ont été envoyées à l&apos;adresse associée.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3.5 rounded-lg border border-border text-center">
                  <p className="text-xs text-muted-foreground leading-normal">
                    En cas de problème persistant, veuillez contacter directement votre responsable d&apos;atelier pour obtenir un nouveau mot de passe.
                  </p>
                </div>
                <Link href="/login" className="block w-full">
                  <Button
                    type="button"
                    className="w-full h-10 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg shadow-md shadow-brand/20 transition-all duration-200"
                  >
                    Retour à la connexion
                  </Button>
                </Link>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          Atelier Maître · Système de gestion automobile · Cameroun
        </p>
      </div>
    </div>
  );
}
