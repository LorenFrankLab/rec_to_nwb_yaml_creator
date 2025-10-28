import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './state/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { library } from "@fortawesome/fontawesome-svg-core";
import { faDownload, faCircleInfo } from "@fortawesome/free-solid-svg-icons";


library.add(faDownload, faCircleInfo);

const root = createRoot(document.getElementById('root'));

root.render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
    </StoreProvider>
  </ErrorBoundary>
);
