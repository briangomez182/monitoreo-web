import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // Las vistas portadas de la SPA sincronizan estado en efectos a propósito
    // (animaciones, polling, modal); se conserva el comportamiento original.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'borrarLuego-*/**', 'data/**'],
  },
];

export default eslintConfig;
