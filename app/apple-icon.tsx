import { ImageResponse } from 'next/og';
import { AppIconShell } from '@/lib/app-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<AppIconShell borderRadius={36} iconSize={96} kenteHeight={8} />, {
    ...size,
  });
}
