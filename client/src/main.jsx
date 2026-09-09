import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './redesign.css';
const MapPage = lazy(() => import('./navigation/MapPage.jsx'));
createRoot(document.getElementById('root')).render(window.location.pathname === '/map' ? <Suspense fallback={<p>Loading campus map…</p>}><MapPage /></Suspense> : <App />);
