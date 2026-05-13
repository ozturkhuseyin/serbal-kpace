import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const loader = document.getElementById('loader');
if (loader) {
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 700);
  }, 400);
}
