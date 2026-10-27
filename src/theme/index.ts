// Design tokens. One place for colour, type and spacing so screens stay consistent.
export const colors = {
  paper: '#F5F7F4',
  card: '#FFFFFF',
  ink: '#14231D',
  inkSoft: '#3B4A44',
  muted: '#6B7772',
  border: '#E1E7E2',
  borderStrong: '#C9D3CC',
  primary: '#1F6F5A',
  primaryDeep: '#155243',
  primarySoft: '#E3F1EC',
  turmeric: '#E9A825',
  turmericSoft: '#FFF4D6',
  // Uncertainty is amber on its own tint so it reads differently from brand accents.
  warn: '#A15C07',
  warnSoft: '#FEF3C7',
  warnBorder: '#F2C94C',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  success: '#1F6F5A',
  overlay: 'rgba(20, 35, 29, 0.45)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  smallStrong: { fontSize: 14, lineHeight: 19, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#14231D',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
