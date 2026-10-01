import type { KeyboardEvent } from 'react';

/**
 * Mini-formulaires imbriqués (création inline client / véhicule).
 *
 * Ne jamais les rendre en <form> : ils vivent souvent DANS un autre formulaire
 * (Nouvel OT). Un <form> imbriqué est du HTML invalide et, en React, son
 * événement submit remonte au formulaire parent → la modale « Nouvel OT » se
 * soumettait / se fermait au clic sur « Créer et sélectionner ».
 *
 * À la place : un conteneur + bouton type="button", et ce handler pour garder
 * « Entrée valide le mini-formulaire » sans déclencher la soumission implicite
 * du formulaire parent.
 */
export function submitOnEnter(onSubmit: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  };
}
