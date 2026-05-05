import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';

// Initial loader'ı root'tan temizle
const root = document.getElementById('root');
const loader = document.getElementById('initial-loader');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Loader'ı küçük bir gecikmeyle kaldır (App mount olduktan sonra)
setTimeout(() => {
  if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
}, 100);
