import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import FAQDetailPage from './pages/FAQDetailPage.jsx';
import './index.css';

export default function App() {
  const location = useLocation();

  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="faq/:id" element={<FAQDetailPage />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
    </AuthProvider>
  );
}