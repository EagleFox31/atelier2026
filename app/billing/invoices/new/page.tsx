'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewInvoicePage() {
  const router = useRouter();
  useEffect(() => {
    // Les factures se créent depuis les OT via /billing/invoice/from-quote/:quoteId
    router.replace('/billing');
  }, [router]);
  return null;
}
