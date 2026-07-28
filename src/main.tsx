import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

// Register Service Worker for PWA and offline caching
registerSW({ immediate: true });

const path = window.location.pathname;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {path === '/privacy' ? (
        <PrivacyPolicy />
      ) : path === '/terms' ? (
        <TermsOfService />
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
