'use client';

import { driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { GuideRole } from '@/lib/guide-roles';
import { TOUR_STEPS_BY_ROLE } from '@/lib/getting-started';

function resolveElement(target?: string): Element | undefined {
  if (!target) return undefined;
  const el = document.querySelector(`[data-tour="${target}"]`);
  return el ?? undefined;
}

export function runProductTour(role: GuideRole): boolean {
  const defs = TOUR_STEPS_BY_ROLE[role];
  if (!defs?.length) return false;

  const steps: DriveStep[] = [];
  for (const step of defs) {
    const element = resolveElement(step.target);
    if (step.target && !element) continue;
    steps.push({
      element: element as HTMLElement | undefined,
      popover: {
        title: step.title,
        description: step.description,
        side: 'bottom',
        align: 'start',
      },
    });
  }

  if (steps.length === 0) return false;

  const config: Config = {
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Suivant',
    prevBtnText: 'Retour',
    doneBtnText: 'Terminer',
    popoverClass: 'atelier-driver-popover',
    stagePadding: 8,
    stageRadius: 12,
    overlayOpacity: 0.55,
    smoothScroll: true,
    steps,
  };

  const driverObj = driver(config);
  driverObj.drive();
  return true;
}
