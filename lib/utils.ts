import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
  }).format(amount).replace('XAF', 'XAF');
}

export function validatePlate(plate: string): boolean {
  // Format: XX-1234-X or XX 1234 X
  const regex = /^[A-Z]{2}[-\s]\d{4}[-\s][A-Z]$/;
  return regex.test(plate.toUpperCase());
}

export function validateCMPhone(phone: string): boolean {
  // Format: +237 6XX XX XX XX or 6XX XX XX XX
  const regex = /^(\+237\s?)?6[5-9]\d{7}$/;
  return regex.test(phone.replace(/\s/g, ''));
}
