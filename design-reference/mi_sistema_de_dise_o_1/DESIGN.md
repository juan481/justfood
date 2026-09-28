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
  primary: '#136d21'
  on-primary: '#ffffff'
  primary-container: '#338738'
  on-primary-container: '#ffffff'
  inverse-primary: '#84da80'
  secondary: '#466643'
  on-secondary: '#ffffff'
  secondary-container: '#c5eabd'
  on-secondary-container: '#4a6a47'
  tertiary: '#9f3960'
  on-tertiary: '#ffffff'
  tertiary-container: '#be5178'
  on-tertiary-container: '#ffffff'
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
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Poppins
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Poppins
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
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
The design system embraces a **Corporate / Modern** aesthetic, prioritizing clarity, trust, and structural reliability. Built around a fidelity-focused variant, the visual language uses a balanced and organic palette rooted in deep forest greens and muted earth tones, evoking sustainability, growth, and professional reliability. Typography is clean and highly legible, powered by the Poppins font family.

## Colors
The color system utilizes a light mode setup structured around semantic derivations from a rich forest green seed color (`#06671b`). 

- **Primary Color (`#338738`)**: Used for primary actions, key highlights, and active states. It communicates growth, success, and dependable functionality.
- **Secondary Color (`#5e7f5a`)**: A muted sage green used for supporting UI elements, secondary buttons, and subtle structural components.
- **Tertiary Color (`#98335a`)**: A contrasting berry/plum tone reserved for accents, badges, or special callouts that require selective attention.
- **Neutral Color (`#737970`)**: A balanced slate-neutral used across typography, borders, and subtle surface fills to maintain high legibility and soft contrast against light backgrounds.

## Typography
All typography across headlines, body text, and UI labels utilizes **Poppins**. Poppins provides a geometric yet friendly appearance that enhances readability at both large and small scales. 

- **Headlines**: Styled with medium-to-semibold weights (`500` / `600`) to create clear hierarchical anchors.
- **Body**: Optimized for dense readability at `16px` (`body-lg`) down to `12px` (`body-sm`) with comfortable line heights.
- **Labels**: Semi-bold weights (`500`) applied to ensure interface controls, form labels, and chips remain distinct.

## Layout & Spacing
The layout model employs a fluid grid system paired with a consistent 2x spatial baseline rhythm. 
- **Gutters & Margins**: Standard column gutters are set to `1rem` with outer canvas margins at `1.5rem` to accommodate varying viewport sizes smoothly.
- **Component Spacing**: Using a standard modular scale (`space-xs` through `space-xl`), padding and component gaps maintain proportional harmony across all form factors, scaling reliably from compact mobile screens to expansive desktop viewports.

## Elevation & Depth
Elevation is handled through a combination of tonal surface layering and soft, low-opacity ambient shadows. Rather than relying on heavy drop shadows, components utilize subtle tonal shifts against the light background, reinforced by low-contrast neutral borders (`#737970`) to establish clear hierarchical separation without visual clutter.

## Shapes
A moderately **Rounded** shape language is utilized (level 2). Interactive elements, containers, and cards feature a friendly `0.5rem` base border radius, scaling up to `1rem` (`rounded-lg`) and `1.5rem` (`rounded-xl`) for larger structural containers, striking a balance between modern approachability and clean structure.

## Components
- **Buttons**: Rounded (`0.5rem`), filled with the primary green (`#338738`) or secondary sage (`#5e7f5a`) for secondary actions. Text uses label typography weights.
- **Chips**: Pill or rounded-md shapes utilizing neutral or tertiary (`#98335a`) accents for categorization and filters.
- **Inputs & Forms**: Outlined with neutral borders, featuring soft rounded corners and Poppins body text. Focus states highlight the primary green.
- **Cards**: Surface containers utilizing level-2 roundedness, subtle tonal layering, and soft borders to cleanly segment content groups.