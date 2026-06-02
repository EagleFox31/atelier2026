import { redirect } from 'next/navigation';

/** Ancienne URL marketing — redirige vers la racine. */
export default function AccueilRedirectPage() {
  redirect('/');
}
