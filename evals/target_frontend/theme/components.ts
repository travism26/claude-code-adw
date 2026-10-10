// v3 recipe/slotRecipe definitions — replaces dead v2 baseStyle/variants syntax.
// v2 pattern used `baseStyle`/`variants`/`defaultProps`; v3 uses `defineRecipe`/
// `defineSlotRecipe` registered under `theme.recipes`/`theme.slotRecipes` in index.ts.
// These are imported and registered there — editing this file now has visible effect.
import { defineRecipe, defineSlotRecipe } from '@chakra-ui/react'

// Button: brand accent, medium weight, rounded corners
export const buttonRecipe = defineRecipe({
  base: {
    fontWeight: 'medium',
    borderRadius: 'lg',
    cursor: 'pointer',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'brand.500',
      outlineOffset: '2px',
    },
  },
  variants: {
    variant: {
      solid: {
        bg: 'brand.500',
        color: 'white',
        _hover: { bg: 'brand.600' },
        _active: { bg: 'brand.700' },
      },
      outline: {
        borderWidth: '1px',
        borderColor: 'brand.500',
        color: 'brand.600',
        _hover: { bg: 'brand.50' },
      },
      ghost: {
        color: 'brand.600',
        _hover: { bg: 'brand.50' },
      },
    },
  },
})

// Input: neutral border, brand focus ring
export const inputRecipe = defineRecipe({
  base: {
    borderColor: 'border',
    _hover: { borderColor: 'brand.400' },
    _focus: {
      borderColor: 'brand.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
    },
  },
})

// Textarea: same focus treatment as Input
export const textareaRecipe = defineRecipe({
  base: {
    borderColor: 'border',
    borderRadius: 'lg',
    _hover: { borderColor: 'brand.400' },
    _focus: {
      borderColor: 'brand.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
    },
  },
})

// NativeSelect: same focus treatment as Input
// v2 mapped to `Select`; v3 uses `nativeSelect` key for the <NativeSelect> compound
export const nativeSelectRecipe = defineRecipe({
  base: {
    borderColor: 'border',
    _hover: { borderColor: 'brand.400' },
    _focus: {
      borderColor: 'brand.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
    },
  },
})

// Card: surface background, subtle border, low shadow, rounded corners
// v2 used `baseStyle.container`; v3 uses slots [root, header, body, footer]
export const cardSlotRecipe = defineSlotRecipe({
  slots: ['root', 'header', 'body', 'footer'],
  base: {
    root: {
      bg: 'surface',
      borderRadius: 'xl',
      border: '1px solid',
      borderColor: 'border',
      boxShadow: 'sm',
      overflow: 'hidden',
    },
    header: {
      padding: '5',
      paddingBottom: '0',
    },
    body: {
      padding: '5',
    },
    footer: {
      padding: '5',
      paddingTop: '0',
    },
  },
})

// Tabs: brand accent for selected state
// v2 used `variants.line.tab._selected`; v3 uses slots [root, list, trigger, content, indicator]
export const tabsSlotRecipe = defineSlotRecipe({
  slots: ['root', 'list', 'trigger', 'content', 'indicator'],
  base: {
    trigger: {
      _selected: {
        color: 'brand.600',
      },
    },
    indicator: {
      bg: 'brand.600',
    },
  },
})
