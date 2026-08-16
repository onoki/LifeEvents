export const PRIVACY_VALUE_MASK = '••••';
export const PRIVACY_RATE_MASK = `${PRIVACY_VALUE_MASK} %`;
export const PRIVACY_DATE_MASK = '••••-••-••';

/**
 * Format a date-like chart tick without exposing its exact value in privacy mode.
 */
export const formatPrivacyAwareDateTick = (
  value: string | number,
  isPrivacyMode: boolean
): string => isPrivacyMode ? PRIVACY_DATE_MASK : String(value);

/**
 * Mask numeric literals while retaining the surrounding explanation and units.
 * This is useful for privacy-mode prose such as scenario labels.
 */
export const maskNumericText = (value: string): string =>
  value.replace(/[+-]?\d+(?:[ .]\d+)*(?:[.,]\d+)?k?/gi, PRIVACY_VALUE_MASK);
