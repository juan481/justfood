---
name: Mi sistema de diseño
colors:
  surface: '#f6fbf0'
  surface-dim: '#d6dcd1'
  surface-bright: '#f6fbf0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5ea'
  surface-container: '#eaf0e5'
  surface-container-high: '#e4eadf'
  surface-container-highest: '#dfe4d9'
  on-surface: '#171d16'
  on-surface-variant: '#40493d'
  inverse-surface: '#2c322b'
  inverse-on-surface: '#edf3e7'
  outline: '#707a6c'
  outline-variant: '#bfcab9'
  surface-tint: '#146d22'
  primary: '#004d11'
  on-primary: '#ffffff'
  primary-container: '#08671c'
  on-primary-container: '#8ce388'
  inverse-primary: '#84da80'
  secondary: '#466643'
  on-secondary: '#ffffff'
  secondary-container: '#c5eabd'
  on-secondary-container: '#4a6a47'
  tertiary: '#7a1a43'
  on-tertiary: '#ffffff'
  tertiary-container: '#98335a'
  on-tertiary-container: '#ffbdcf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ff799'
  primary-fixed-dim: '#84da80'
  on-primary-fixed: '#002204'
  on-primary-fixed-variant: '#005313'
  secondary-fixed: '#c8ecc0'
  secondary-fixed-dim: '#acd0a5'
  on-secondary-fixed: '#032106'
  on-secondary-fixed-variant: '#2f4e2d'
  tertiary-fixed: '#ffd9e2'
  tertiary-fixed-dim: '#ffb1c7'
  on-tertiary-fixed: '#3e001d'
  on-tertiary-fixed-variant: '#812148'
  background: '#f6fbf0'
  on-background: '#171d16'
  surface-variant: '#dfe4d9'
typography:
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-md:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Design System

## Brand & Style
The design system adopts a **Corporate / Modern** style paired with a fidelity color variant, conveying reliability, balance, and professionalism. The interface utilizes the **Poppins** typeface to establish a clean, approachable, yet authoritative tone suitable for contemporary digital platforms.

## Colors
The color system is built on a semantic foundation in a **light** color mode, driven by the seed color `#06671b`. 
- **Primary (`#338738`)**: Serves as the principal brand anchor for primary actions, key interactive states, and focal points.
- **Secondary (`#5e7f5a`)**: Provides balanced support for secondary elements and complementary UI components.
- **Tertiary (`#98335a`)**: Offers an accent hue for highlights and specific state callouts.
- **Neutral (`#737970`)**: Forms the structural backbone for text, backgrounds, and subtle borders.

## Typography
The typography system uses **Poppins** uniformly across headlines, body text, and labels, ensuring a consistent, geometric, and modern visual rhythm. Sizes scale cleanly from large headings down to concise micro-labels, maintaining legibility and structure across all screen form factors.

## Layout & Spacing
A structured spacing rhythm (level 2) governs the layout, utilizing consistent grid gutters (`1rem`), canvas margins (`1.5rem`), and a proportional spacing scale (`space-xs` through `space-xl`) to establish predictable whitespace and rhythm across components and screen sizes.

## Elevation & Depth
Elevation is achieved through subtle tonal layers and clean, low-contrast outlines. Depth hierarchy relies on soft surface differentiation rather than heavy drop shadows, reinforcing a modern, flat-yet-layered aesthetic.

## Shapes
The shape language uses a **Rounded** profile (`roundedness: 2`). UI elements feature a default `0.5rem` border radius, scaling up to `1rem` (`rounded-lg`) and `1.5rem` (`rounded-xl`) for larger containers, cards, and primary surfaces, creating a friendly and approachable feel.

## Components
- **Buttons**: Utilize the primary color `#338738` for main actions, featuring rounded corners (`0.5rem` radius) and Poppins label typography.
- **Inputs**: Clean text fields with neutral borders (`#737970`), focusing with primary highlights.
- **Cards**: Surface containers utilizing rounded shapes and subtle tonal separation.
- **Chips & Badges**: Compact elements utilizing secondary and tertiary accents.