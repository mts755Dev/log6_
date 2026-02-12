import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider } from './contexts/ToastContext';

// Layouts
import { DashboardLayout } from './components/layouts/DashboardLayout';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { CustomerQuoteViewPage } from './pages/CustomerQuoteViewPage';
import { CustomerInvoiceViewPage } from './pages/CustomerInvoiceViewPage';
import { AppointmentConfirmationPage } from './pages/AppointmentConfirmationPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CompaniesPage } from './pages/admin/CompaniesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { ProductsAdminPage } from './pages/admin/ProductsAdminPage';
import { AdminQuotesPage } from './pages/admin/AdminQuotesPage';
import { DocumentBankPage } from './pages/admin/DocumentBankPage';
import { TemplatesPage } from './pages/admin/TemplatesPage';
import { InvoicesPage } from './pages/admin/InvoicesPage';
import { VerificationPage } from './pages/admin/VerificationPage';

// Installer Pages
import { InstallerDashboard } from './pages/installer/InstallerDashboard';
import { NewQuotePage } from './pages/installer/NewQuotePage';
import { QuotesListPage } from './pages/installer/QuotesListPage';
import { QuoteDetailPage } from './pages/installer/QuoteDetailPage';
import { ProductsPage } from './pages/installer/ProductsPage';
import { SettingsPage } from './pages/installer/SettingsPage';
import { CommissionsPage } from './pages/installer/CommissionsPage';
import { MISDocumentsPage } from './pages/installer/MISDocumentsPage';
import { InstallerInvoicesPage } from './pages/installer/InstallerInvoicesPage';
import { EngineersPage } from './pages/installer/EngineersPage';
import { OnboardingPage } from './pages/installer/OnboardingPage';
import { InstallationSchedulerPage } from './pages/installer/InstallationSchedulerPage';

// Assessor Pages
import { AssessorDashboard } from './pages/assessor/AssessorDashboard';
import { PendingPage } from './pages/assessor/PendingPage';
import { ReviewPage } from './pages/assessor/ReviewPage';

// Compliance Pages
import { ComplianceDashboard } from './pages/compliance/ComplianceDashboard';
import { InstallationReviewPage } from './pages/compliance/InstallationReviewPage';

// Engineer Pages
import { EngineerDashboard } from './pages/engineer/EngineerDashboard';
import { CommissioningUploadPage } from './pages/engineer/CommissioningUploadPage';
import { EngineerAvailabilityPage } from './pages/engineer/EngineerAvailabilityPage';

// Placeholder Page for routes under development
import { PlaceholderPage } from './pages/PlaceholderPage';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login/:role" element={<LoginPage />} />
            <Route path="/signup/:role" element={<SignupPage />} />
            <Route path="/quote/:quoteId/:token" element={<CustomerQuoteViewPage />} />
            <Route path="/invoice/:invoiceId" element={<CustomerInvoiceViewPage />} />
            <Route path="/confirm-appointment/:token" element={<AppointmentConfirmationPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<DashboardLayout requiredRole="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="products" element={<ProductsAdminPage />} />
              <Route path="documents" element={<DocumentBankPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="quotes" element={<AdminQuotesPage />} />
              <Route path="submissions" element={<PlaceholderPage />} />
              <Route path="certificates" element={<PlaceholderPage />} />
              <Route path="settings" element={<PlaceholderPage />} />
            </Route>

            {/* Installer Routes */}
            <Route path="/installer" element={<DashboardLayout requiredRole="installer" />}>
              <Route index element={<InstallerDashboard />} />
              <Route path="quotes" element={<QuotesListPage />} />
              <Route path="quotes/new" element={<NewQuotePage />} />
              <Route path="quotes/:id/edit" element={<NewQuotePage />} />
              <Route path="quotes/:id" element={<QuoteDetailPage />} />
              <Route path="scheduler" element={<InstallationSchedulerPage />} />
              <Route path="proposals" element={<PlaceholderPage />} />
              <Route path="invoices" element={<InstallerInvoicesPage />} />
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="mis-documents" element={<MISDocumentsPage />} />
              <Route path="onboarding" element={<OnboardingPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="engineers" element={<EngineersPage />} />
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

            {/* Compliance Officer Routes */}
            <Route path="/compliance" element={<DashboardLayout requiredRole="compliance_officer" />}>
              <Route index element={<ComplianceDashboard />} />
              <Route path="dashboard" element={<ComplianceDashboard />} />
              <Route path="review/:quoteId" element={<InstallationReviewPage />} />
              <Route path="pending" element={<ComplianceDashboard />} />
              <Route path="approved" element={<PlaceholderPage />} />
              <Route path="rejected" element={<PlaceholderPage />} />
              <Route path="certificates" element={<PlaceholderPage />} />
              <Route path="settings" element={<PlaceholderPage />} />
            </Route>

            {/* Engineer Routes */}
            <Route path="/engineer" element={<DashboardLayout requiredRole="engineer" />}>
              <Route index element={<EngineerDashboard />} />
              <Route path="job/:jobId" element={<CommissioningUploadPage />} />
              <Route path="availability" element={<EngineerAvailabilityPage />} />
              <Route path="settings" element={<PlaceholderPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;