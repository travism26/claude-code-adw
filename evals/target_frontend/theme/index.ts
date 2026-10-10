import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { colors } from './colors'
import { foundations } from './foundations'
import {
  buttonRecipe,
  inputRecipe,
  textareaRecipe,
  nativeSelectRecipe,
  cardSlotRecipe,
  tabsSlotRecipe,
} from './components'

// GrowBuddy v3 design system — single source of truth for all visual tokens.
// All screens and components inherit from here via Chakra's CSS-variable cascade.
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Brand green accent (#22c55e) — used only for actions/active states/focus
        brand: {
          50: { value: colors.brand[50] },
          100: { value: colors.brand[100] },
          200: { value: colors.brand[200] },
          300: { value: colors.brand[300] },
          400: { value: colors.brand[400] },
          500: { value: colors.brand[500] },
          600: { value: colors.brand[600] },
          700: { value: colors.brand[700] },
          800: { value: colors.brand[800] },
          900: { value: colors.brand[900] },
        },
        // True neutral gray ramp — overrides Chakra default (which has a blue tint)
        gray: {
          50: { value: colors.gray[50] },
          100: { value: colors.gray[100] },
          200: { value: colors.gray[200] },
          300: { value: colors.gray[300] },
          400: { value: colors.gray[400] },
          500: { value: colors.gray[500] },
          600: { value: colors.gray[600] },
          700: { value: colors.gray[700] },
          800: { value: colors.gray[800] },
          900: { value: colors.gray[900] },
        },
      },
      fonts: {
        heading: { value: foundations.fonts.heading },
        body: { value: foundations.fonts.body },
      },
      // Wire fontSizes from foundations (were orphaned — defaultConfig values were used instead)
      fontSizes: {
        xs: { value: foundations.fontSizes.xs },
        sm: { value: foundations.fontSizes.sm },
        md: { value: foundations.fontSizes.md },
        lg: { value: foundations.fontSizes.lg },
        xl: { value: foundations.fontSizes.xl },
        '2xl': { value: foundations.fontSizes['2xl'] },
        '3xl': { value: foundations.fontSizes['3xl'] },
        '4xl': { value: foundations.fontSizes['4xl'] },
        '5xl': { value: foundations.fontSizes['5xl'] },
        '6xl': { value: foundations.fontSizes['6xl'] },
      },
      // Wire radii from foundations (were orphaned); lg=8px and xl=12px for cards
      radii: {
        none: { value: foundations.radii.none },
        sm: { value: foundations.radii.sm },
        base: { value: foundations.radii.base },
        md: { value: foundations.radii.md },
        lg: { value: foundations.radii.lg },
        xl: { value: foundations.radii.xl },
        '2xl': { value: foundations.radii['2xl'] },
        '3xl': { value: foundations.radii['3xl'] },
        full: { value: foundations.radii.full },
      },
      // Shadow scale — new; none existed before (spec requirement)
      shadows: {
        none: { value: foundations.shadows.none },
        xs: { value: foundations.shadows.xs },
        sm: { value: foundations.shadows.sm },
        md: { value: foundations.shadows.md },
        lg: { value: foundations.shadows.lg },
        xl: { value: foundations.shadows.xl },
      },
      // Wire spacing from foundations (were orphaned)
      spacing: {
        px: { value: foundations.space.px },
        0.5: { value: foundations.space[0.5] },
        1: { value: foundations.space[1] },
        1.5: { value: foundations.space[1.5] },
        2: { value: foundations.space[2] },
        2.5: { value: foundations.space[2.5] },
        3: { value: foundations.space[3] },
        3.5: { value: foundations.space[3.5] },
        4: { value: foundations.space[4] },
        5: { value: foundations.space[5] },
        6: { value: foundations.space[6] },
        7: { value: foundations.space[7] },
        8: { value: foundations.space[8] },
        9: { value: foundations.space[9] },
        10: { value: foundations.space[10] },
        12: { value: foundations.space[12] },
        14: { value: foundations.space[14] },
        16: { value: foundations.space[16] },
        20: { value: foundations.space[20] },
        24: { value: foundations.space[24] },
        28: { value: foundations.space[28] },
        32: { value: foundations.space[32] },
        36: { value: foundations.space[36] },
        40: { value: foundations.space[40] },
        44: { value: foundations.space[44] },
        48: { value: foundations.space[48] },
        52: { value: foundations.space[52] },
        56: { value: foundations.space[56] },
        60: { value: foundations.space[60] },
        64: { value: foundations.space[64] },
        72: { value: foundations.space[72] },
        80: { value: foundations.space[80] },
        96: { value: foundations.space[96] },
      },
    },
    // Semantic color tokens — use these in components instead of raw literals.
    // They resolve correctly in light and dark contexts via CSS variables.
    semanticTokens: {
      colors: {
        bg: { value: { base: '{colors.gray.50}', _dark: '{colors.gray.900}' } },
        surface: { value: { base: 'white', _dark: '{colors.gray.800}' } },
        border: { value: { base: '{colors.gray.200}', _dark: '{colors.gray.700}' } },
        text: { value: { base: '{colors.gray.900}', _dark: '{colors.gray.50}' } },
        textMuted: { value: { base: '{colors.gray.500}', _dark: '{colors.gray.400}' } },
        accent: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
        accentEmphasis: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.500}' } },
        accentSubtle: { value: { base: '{colors.brand.50}', _dark: '{colors.brand.900}' } },
        success: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
        warn: { value: { base: '#f59e0b', _dark: '#fbbf24' } },
        danger: { value: { base: '#ef4444', _dark: '#f87171' } },
      },
    },
    // v3 recipes registered here (components.ts is imported and live — no longer dead code)
    recipes: {
      button: buttonRecipe,
      input: inputRecipe,
      textarea: textareaRecipe,
      nativeSelect: nativeSelectRecipe,
    },
    slotRecipes: {
      card: cardSlotRecipe,
      tabs: tabsSlotRecipe,
    },
  },
  globalCss: {
    body: {
      // Semantic tokens instead of hardcoded green.50 / gray.800
      bg: 'bg',
      color: 'text',
    },
  },
})

const system = createSystem(defaultConfig, config)

export default system
