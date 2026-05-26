'use client';

import * as React from "react";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  Wrench,
  Car,
  Search,
  Plus
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Tapez une commande ou recherchez..." />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
        <CommandGroup heading="Actions Rapides">
          <CommandItem onSelect={() => runCommand(() => router.push("/workshop"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nouvel Ordre de Travail</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/vehicles"))}>
            <Car className="mr-2 h-4 w-4" />
            <span>Ajouter un Véhicule</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/billing"))}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Créer une Facture</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Tableau de bord</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/workshop"))}>
            <Wrench className="mr-2 h-4 w-4" />
            <span>Atelier</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/stock"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Stock</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
