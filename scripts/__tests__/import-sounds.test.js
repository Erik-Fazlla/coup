const fs = require('fs');
const path = require('path');
const { MANIFEST, RAW_DIR, resourceName, ffmpegArgs } = require('../import-sounds');

describe('resourceName', () => {
  it('turns a JS sound name into an Android resource name', () => {
    expect(resourceName('turn')).toBe('sfx_turn');
    expect(resourceName('revealTrue')).toBe('sfx_reveal_true');
    expect(resourceName('gameLost')).toBe('sfx_game_lost');
  });
});

describe('ffmpegArgs', () => {
  it('converts to mono OGG Vorbis at a matched loudness', () => {
    const args = ffmpegArgs('in.ogg', 'out.ogg', {});
    expect(args).toEqual(expect.arrayContaining(['-ac', '1', '-c:a', 'libvorbis']));
    expect(args.join(' ')).toContain('loudnorm');
    expect(args[args.length - 1]).toBe('out.ogg');
  });

  it('cuts and fades a long source when the manifest gives seconds', () => {
    const args = ffmpegArgs('in.ogg', 'out.ogg', { seconds: 0.9 });
    expect(args).toEqual(expect.arrayContaining(['-t', '0.9']));
    expect(args.join(' ')).toContain('afade=t=out');
  });
});

describe('the committed sounds', () => {
  it('has a source file for every manifest entry', () => {
    for (const entry of Object.values(MANIFEST)) {
      expect(fs.existsSync(path.join(__dirname, '../../assets/sounds/source', entry.source))).toBe(true);
    }
  });

  it('has a converted file in res/raw for every manifest entry, and nothing left over', () => {
    const expected = Object.keys(MANIFEST).map(name => `${resourceName(name)}.ogg`).sort();
    const present = fs.readdirSync(RAW_DIR).filter(file => file.startsWith('sfx_')).sort();
    expect(present).toEqual(expected);
  });
});
