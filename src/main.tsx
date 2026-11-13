import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { AppProvider } from './app/AppProvider';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Tickwell could not find its root element.');

// No StrictMode: the store is created once outside React and double effects add nothing here.
createRoot(container).render(
  <AppProvider>
    <App />
  </AppProvider>,
);

// Work offline: the service worker caches the app after the first visit.
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('tickwell:offline-ready'));
    },
  });
}
