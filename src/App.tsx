import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

// Layouts
import { DashboardLayout } from './components/layouts/DashboardLayout';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CompaniesPage } from './pages/admin/CompaniesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { ProductsAdminPage } from './pages/admin/ProductsAdminPage';

// Installer Pages
import { InstallerDashboard } from './pages/installer/InstallerDashboard';
import { NewQuotePage } from './pages/installer/NewQuotePage';
import { QuotesListPage } from './pages/installer/QuotesListPage';
import { QuoteDetailPage } from './pages/installer/QuoteDetailPage';
import { ProductsPage } from './pages/installer/ProductsPage';
import { SettingsPage } from './pages/installer/SettingsPage';
import { CommissionsPage } from './pages/installer/CommissionsPage';
import { MISDocumentsPage } from './pages/installer/MISDocumentsPage';

// Assessor Pages
import { AssessorDashboard } from './pages/assessor/AssessorDashboard';
import { PendingPage } from './pages/assessor/PendingPage';
import { ReviewPage } from './pages/assessor/ReviewPage';

// Placeholder Page for routes under development
import { PlaceholderPage } from './pages/PlaceholderPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login/:role" element={<LoginPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<DashboardLayout requiredRole="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="products" element={<ProductsAdminPage />} />
              <Route path="quotes" element={<PlaceholderPage />} />
              <Route path="submissions" element={<PlaceholderPage />} />
              <Route path="certificates" element={<PlaceholderPage />} />
              <Route path="settings" element={<PlaceholderPage />} />
            </Route>

            {/* Installer Routes */}
            <Route path="/installer" element={<DashboardLayout requiredRole="installer" />}>
              <Route index element={<InstallerDashboard />} />
              <Route path="quotes" element={<QuotesListPage />} />
              <Route path="quotes/new" element={<NewQuotePage />} />
              <Route path="quotes/:id" element={<QuoteDetailPage />} />
              <Route path="proposals" element={<PlaceholderPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="mis-documents" element={<MISDocumentsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Assessor Routes */}
            <Route path="/assessor" element={<DashboardLayout requiredRole="assessor" />}>
              <Route index element={<AssessorDashboard />} />
              <Route path="pending" element={<PendingPage />} />
              <Route path="review/:id" element={<ReviewPage />} />
              <Route path="approved" element={<PlaceholderPage />} />
              <Route path="rejected" element={<PlaceholderPage />} />
              <Route path="certificates" element={<PlaceholderPage />} />
              <Route path="settings" element={<PlaceholderPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

