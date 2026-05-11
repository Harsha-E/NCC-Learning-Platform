/**
 * Gets a CSS variable value from the root document.
 * Useful for keeping Canvas charts in sync with the theme.
 */
export function getThemeVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export const ChartTheme = () => ({
  textColor: getThemeVar('--text-primary'),
  gridColor: getThemeVar('--border-color'),
  accent: getThemeVar('--accent-primary')
});