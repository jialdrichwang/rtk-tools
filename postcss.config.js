import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const legacyColorPlugin = () => ({
  postcssPlugin: 'legacy-color-transform',
  Declaration(decl) {
    if (!decl.value) return;
    if (decl.value.includes('rgb(')) {
      decl.value = decl.value.replace(
        /rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([^)]+))?\s*\)/g,
        (match, r, g, b, a) => {
          if (a !== undefined) {
            return `rgba(${r}, ${g}, ${b}, ${a.trim()})`;
          }
          return `rgb(${r}, ${g}, ${b})`;
        }
      );
    }
    if (decl.value.includes('hsl(')) {
      decl.value = decl.value.replace(
        /hsl\(\s*([\d.]+)\s+([\d.]+%)\s+([\d.]+%)(?:\s*\/\s*([^)]+))?\s*\)/g,
        (match, h, s, l, a) => {
          if (a !== undefined) {
            return `hsla(${h}, ${s}, ${l}, ${a.trim()})`;
          }
          return `hsl(${h}, ${s}, ${l})`;
        }
      );
    }
  },
});
legacyColorPlugin.postcss = true;

export default {
  plugins: [
    tailwindcss,
    autoprefixer,
    legacyColorPlugin,
  ],
};
