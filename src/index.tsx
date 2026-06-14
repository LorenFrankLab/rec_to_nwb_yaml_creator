import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './state/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { library } from "@fortawesome/fontawesome-svg-core";
import { faDownload, faCircleInfo } from "@fortawesome/free-solid-svg-icons";


library.add(faDownload, faCircleInfo);

// The #root element is guaranteed by index.html (the Vite entry / mount point).
const root = createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
    </StoreProvider>
  </ErrorBoundary>
);
