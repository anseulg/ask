import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from './astryx-themes';
import './index.css';
import RoadmapPage from './pages/RoadmapPage';

type Mode = 'light' | 'dark' | 'system';

// The viewer sets data-theme on <html> for an explicit choice and nothing for
// "system", so follow that attribute live.
function readMode(): Mode {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

function App() {
  const [mode, setMode] = useState<Mode>(readMode);
  useEffect(() => {
    const obs = new MutationObserver(() => setMode(readMode()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);
  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <RoadmapPage />
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
