import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useAuthStore } from './stores/useAuthStore';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

try {
  useAuthStore.getState().hydrateFromStorage();
} catch {
  // ignore
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
