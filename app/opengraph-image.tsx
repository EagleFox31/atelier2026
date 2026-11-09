import { ImageResponse } from 'next/og';

export const alt = 'Atelier Maître — logiciel de gestion de garage au Cameroun';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#1A0F06',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: 34, color: '#F2C95A', letterSpacing: 4, textTransform: 'uppercase' }}>
          Logiciel garage · Cameroun
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 24 }}>Atelier Maître</div>
        <div style={{ fontSize: 40, marginTop: 24, color: 'rgba(255,255,255,0.8)' }}>
          OT, devis, factures XAF, stock et planning.
        </div>
        <div style={{ fontSize: 28, marginTop: 48, color: 'rgba(255,255,255,0.5)' }}>par Trigenys Group</div>
      </div>
    ),
    { ...size },
  );
}
