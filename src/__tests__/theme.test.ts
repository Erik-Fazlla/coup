import { colors, glow, glowText, neon } from '../theme';

describe('Noir Neon theme', () => {
  it('has the brand colours from the intro', () => {
    expect(neon.cyan).toBe('#00E5FF');
    expect(neon.blue).toBe('#1E6BFF');
  });

  it('keeps cyan as the one "you / tap here" colour', () => {
    expect(colors.primary).toBe(neon.cyan);
  });

  it('keeps the table black and the coins gold', () => {
    expect(colors.background).toBe('#000000');
    expect(colors.coin).toBe('#f5c542');
  });

  it('describes glows as box shadows', () => {
    for (const value of Object.values(glow)) {
      expect(value).toMatch(/^0 0 \d+px rgba\(/);
    }
  });

  it('gives big titles a soft cyan text glow', () => {
    expect(glowText).toEqual({
      textShadowColor: neon.cyan,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
    });
  });
});
