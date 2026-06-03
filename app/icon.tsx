import { ImageResponse } from 'next/og';
import { AppIconShell } from '@/lib/app-icon';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<AppIconShell borderRadius={96} iconSize={280} kenteHeight={18} />, {
    ...size,
  });
}
