import {
  formatPrivacyAwareDateTick,
  PRIVACY_DATE_MASK,
  PRIVACY_RATE_MASK,
  PRIVACY_VALUE_MASK,
  maskNumericText,
} from '../privacy-utils';

describe('privacy-utils', () => {
  it('provides stable masks for rates, dates, and exact values', () => {
    expect(PRIVACY_RATE_MASK).toBe('•••• %');
    expect(PRIVACY_DATE_MASK).toBe('••••-••-••');
    expect(PRIVACY_VALUE_MASK).toBe('••••');
  });

  it('masks chart date ticks only in privacy mode', () => {
    expect(formatPrivacyAwareDateTick('Jun 42', true)).toBe(PRIVACY_DATE_MASK);
    expect(formatPrivacyAwareDateTick('Jun 42', false)).toBe('Jun 42');
  });

  it('masks monetary and duration numbers while retaining explanatory text', () => {
    expect(maskNumericText('-500 €/month vs planned')).toBe('•••• €/month vs planned');
    expect(maskNumericText('+10 000 € lump sum now')).toBe('•••• € lump sum now');
    expect(maskNumericText('Loan 10k, repay over 3 months')).toBe('Loan ••••, repay over •••• months');
  });
});
