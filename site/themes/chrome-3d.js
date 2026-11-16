// Page chrome for the 3D viewer, one entry per theme. The renderer reads these
// by name and holds no palette of its own. Each accent is at least 3:1
// against its panel, so a card border can be seen.
export const CHROME_3D = {
  empire: {
    id: 'empire',
    starStyle: 'soft',
    starColor: '#ffe0a0',
    space: { base: '#5a6270', center: '#687282', edge: '#4b525e', dark: false },
    panel: '#EEF1F5',
    text: '#12202b',
    accent: '#1d6a9e',
    title: '#1d6a9e'
  },
  mardat: {
    id: 'mardat',
    starStyle: 'fiery',
    starColor: '#ffcf6e',
    space: { base: '#17143e', center: '#221c52', edge: '#0b0a24', dark: true },
    panel: '#2b2e34',
    text: '#f1f2f4',
    accent: '#ff2e48',
    title: '#7aa2ff'
  }
};

export const DEFAULT_CHROME_3D = 'empire';
