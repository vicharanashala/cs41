import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import SubmitQuestionPage from './pages/SubmitQuestionPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import FAQDetailPage from './pages/FAQDetailPage.jsx';
import FacultyRoute from './components/FacultyRoute.jsx';
import FacultyLayout from './components/FacultyLayout.jsx';
import DashboardPage from './pages/faculty/DashboardPage.jsx';
import ReviewQueuePage from './pages/faculty/ReviewQueuePage.jsx';
import QuestionReviewPage from './pages/faculty/QuestionReviewPage.jsx';
import ModerationPage from './pages/faculty/ModerationPage.jsx';
import StudentManagementPage from './pages/faculty/StudentManagementPage.jsx';
import AuditLogPage from './pages/faculty/AuditLogPage.jsx';
import TagsManagementPage from './pages/faculty/TagsManagementPage.jsx';
import AnalyticsPage from './pages/faculty/AnalyticsPage.jsx';
import SettingsPage from './pages/faculty/SettingsPage.jsx';
import './index.css';

export default function App() {
  const location = useLocation();

  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="faq/:id" element={<FAQDetailPage />} />
            <Route path="submit" element={<SubmitQuestionPage />} />
          </Route>

          {/* Faculty portal — all routes protected by FacultyRoute (role=faculty required) */}
          <Route path="/faculty" element={
            <FacultyRoute><FacultyLayout /></FacultyRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="queue" element={<ReviewQueuePage />} />
            <Route path="queue/:id" element={<QuestionReviewPage />} />
            <Route path="moderation" element={<ModerationPage />} />
            <Route path="students" element={<StudentManagementPage />} />
            <Route path="tags" element={<TagsManagementPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </AuthProvider>
  );
}