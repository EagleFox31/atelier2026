import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';

/** Styles partagés favicon / apple-icon / PWA */
export const APP_ICON = {
  background: `linear-gradient(145deg, ${C.earth} 0%, #2D1B09 42%, ${C.brand} 100%)`,
  kenteBar: `linear-gradient(90deg, ${C.brand} 0%, ${C.brand} 20%, ${C.gold} 20%, ${C.gold} 40%, ${C.green} 40%, ${C.green} 60%, ${C.brandDeep} 60%, ${C.brandDeep} 80%, ${C.goldLight} 80%, ${C.goldLight} 100%)`,
  wrenchStroke: C.goldLight,
  themeColor: C.brand,
  backgroundColor: C.surface,
} as const;

const WRENCH_PATH =
  'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';

type AppIconShellProps = {
  borderRadius: number;
  iconSize: number;
  kenteHeight?: number;
};

/** Marque visuelle Atelier Maître — compatible ImageResponse (next/og). */
export function AppIconShell({ borderRadius, iconSize, kenteHeight = 14 }: AppIconShellProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: APP_ICON.background,
        borderRadius,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={APP_ICON.wrenchStroke}
        strokeWidth="1.85"
      >
        <path d={WRENCH_PATH} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: kenteHeight,
          background: APP_ICON.kenteBar,
        }}
      />
    </div>
  );
}
