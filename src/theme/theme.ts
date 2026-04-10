/**
 * DetoxMove Dashboard-Identical Design System ✨
 * Strictly matching the Teal (#14B8A6) and Slate colors from the main Dashboard.
 */

export const Colors = {
  // Brand Colors (Directly from Dashboard)
  primary: '#14B8A6',       // The iconic Teal
  primaryDark: '#0D9488',   // The darker shade for gradients/depth
  primaryLight: '#F0FDFA',  // The minty soft background from Dashboard header

  // High energy / Accent
  accent: '#14B8A6',        // Keeping it consistent with Primary

  // UI Colors
  background: '#F8FAFC',    // Very clean background
  surface: '#FFFFFF',       // Pure white cards
  border: '#F1F5F9',

  // Using Slate for powerful headings/text (Not pure black)
  secondary: '#0F172A',
  secondaryLight: '#1E293B',

  // Feedback Colors
  warning: '#FBBF24',
  danger: '#EF4444',
  success: '#10B981',

  // Text Colors
  textMain: '#0F172A',      // Primary Headings
  textSub: '#64748B',       // Muted/Sub-text
  textPlaceholder: '#94A3B8',
  textInverse: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const Shadows = {
  soft: {
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  }
};

const Theme = {
  Colors,
  Spacing,
  Radius,
  Shadows,
};

export default Theme;
