import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import Lenis from 'lenis';
import EstateAgentHome from "@/pages/EstateAgentHome";
import PropertyListingsPage from "@/pages/PropertyListingsPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import SalesPage from "@/pages/SalesPage";
import RentalsPage from "@/pages/RentalsPage";
import CommercialPage from "@/pages/CommercialPage";
import CommercialSalesPage from "@/pages/CommercialSalesPage";
import CommercialLettingsPage from "@/pages/CommercialLettingsPage";
import InvestmentOpportunitiesPage from "@/pages/InvestmentOpportunitiesPage";
import PortfolioManagementPage from "@/pages/PortfolioManagementPage";
import ValuationPage from "@/pages/ValuationPage";
import RegisterRentalPage from "@/pages/RegisterRentalPage";
import AreaPage from "@/pages/AreaPage";
import ScrollToTop from "@/components/ScrollToTop";
import { Switch, Route, useLocation } from "wouter";
import { useRef } from 'react';
import { AuthProvider } from "@/hooks/use-auth";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "@/lib/protected-route";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import TestEmailPage from "@/pages/TestEmailPage";
import TestSmsPage from "@/pages/TestSmsPage";
import TestDashboardPage from "@/pages/TestDashboardPage";

// CRM Pages
import CRMLogin from "@/pages/CRMLogin";
import CRMDashboard from "@/pages/CRMDashboard";
import PropertyCreate from "@/pages/PropertyCreate";
import PropertyEdit from "@/pages/PropertyEdit";
import WorkflowManagement from "@/pages/WorkflowManagement";
import PropertyManagement from "@/pages/PropertyManagement";
import TenantDetails from "@/pages/TenantDetails";
import VoiceAgentDashboard from "@/pages/VoiceAgentDashboard";
import Login from "@/pages/Login";
import TenantPortal from "@/pages/TenantPortal";
import UserDashboard from "@/pages/UserDashboard";
import UserManagement from "@/pages/UserManagement";
import CommunicationHub from "@/pages/CommunicationHub";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";
import PropertySyndication from "@/pages/PropertySyndication";
import CalendarIntegration from "@/pages/CalendarIntegration";
import ReportBuilder from "@/pages/ReportBuilder";
import StaffManagement from "@/pages/StaffManagement";
import Portal from "@/pages/Portal";
import PaymentPage from "@/pages/PaymentPage";
import IntegrationsSettings from "@/pages/IntegrationsSettings";
import AgentSettings from "@/pages/AgentSettings";
import LeadGeneration from "@/pages/LeadGeneration";
import LeadManagement from "@/pages/LeadManagement";
import WebsiteLeads from "@/pages/WebsiteLeads";
import AIAgentDashboard from "@/pages/AIAgentDashboard";
import LandlordManagement from "@/pages/LandlordManagement";
import LandlordProperties from "@/pages/LandlordProperties";
import TenantManagement from "@/pages/TenantManagement";
import RentalAgreements from "@/pages/RentalAgreements";
import SupportTickets from "@/pages/SupportTickets";
import ComplianceReference from "@/pages/ComplianceReference";
import LandlordOnboarding from "@/pages/LandlordOnboarding";
import TenantOnboarding from "@/pages/TenantOnboarding";
import PropertyOnboarding from "@/pages/PropertyOnboarding";
import ManagedPropertyCard from "@/pages/ManagedPropertyCard";
import LandlordDetails from "@/pages/LandlordDetails";
import ContactManagement from "@/pages/ContactManagement";
import SalesProgressionPage from "@/pages/SalesProgressionPage";
import ContractorManagement from "@/pages/ContractorManagement";
import LandlordLeadPipeline from "@/pages/LandlordLeadPipeline";
import LandlordLeadDetails from "@/pages/LandlordLeadDetails";
import PropertyImport from "@/pages/PropertyImport";
import TermsAndConditions from "@/pages/TermsAndConditions";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import SecurityMatrix from "@/pages/SecurityMatrix";
import CMSManagement from "@/pages/CMSManagement";
import CMSPageEditor from "@/pages/CMSPageEditor";
import CMSMediaLibrary from "@/pages/CMSMediaLibrary";
import TeamPageSettings from "@/pages/TeamPageSettings";
import TeamPage from "@/pages/TeamPage";
import { ProtectedRoute as ClearanceProtectedRoute } from "@/components/ProtectedRoute";

// Area-specific pages
import BayswaterPage from "@/pages/areas/BayswaterPage";
import HarlesdenPage from "@/pages/areas/HarlesdenPage";
import KensalGreenPage from "@/pages/areas/KensalGreenPage";
import KensalRisePage from "@/pages/areas/KensalRisePage";
import KilburnPage from "@/pages/areas/KilburnPage";
import LabdrokeGrovePage from "@/pages/areas/LabdrokeGrovePage";
import MaidaValePage from "@/pages/areas/MaidaValePage";
import NorthKensingtonPage from "@/pages/areas/NorthKensingtonPage";
import QueensParkPage from "@/pages/areas/QueensParkPage";
import WestbourneParkPage from "@/pages/areas/WestbourneParkPage";
import WillesdenPage from "@/pages/areas/WillesdenPage";


function App() {
  const [location] = useLocation();
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if this is a CRM/admin page
    const isCrmPage = location.startsWith('/crm') || location.startsWith('/portal') || location.startsWith('/dashboard') || location.startsWith('/login');

    // Always destroy existing Lenis instance first
    if (lenisRef.current) {
      lenisRef.current.destroy();
      lenisRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Don't use Lenis on CRM pages - it interferes with form interactions
    if (isCrmPage) {
      // Ensure smooth scroll is reset to native
      document.documentElement.style.scrollBehavior = 'auto';
      return;
    }

    // Initialize Lenis for public pages only
    const lenis = new Lenis();
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }

    rafRef.current = requestAnimationFrame(raf);

    // Cleanup
    return () => {
      lenis.destroy();
      lenisRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [location]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Helmet>
            <title>John Barclay Estate & Management | Luxury London Properties</title>
            <meta name="description" content="Premium estate agency services across West London's most desirable areas. Expert property sales, lettings, and valuations." />
          </Helmet>

          <main className="flex-grow">
            <Router />
          </main>
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={EstateAgentHome} />
        <Route path="/search" component={PropertyListingsPage} />
        <Route path="/properties" component={PropertyListingsPage} />
        <Route path="/sales" component={SalesPage} />
        <Route path="/rentals" component={RentalsPage} />
        <Route path="/commercial" component={CommercialPage} />
        <Route path="/commercial-sales" component={CommercialSalesPage} />
        <Route path="/commercial-lettings" component={CommercialLettingsPage} />
        <Route path="/investment-opportunities" component={InvestmentOpportunitiesPage} />
        <Route path="/portfolio-management" component={PortfolioManagementPage} />
        <Route path="/valuation" component={ValuationPage} />
        <Route path="/register-rental" component={RegisterRentalPage} />
        <Route path="/area/:postcode" component={AreaPage} />
        <Route path="/property/:id" component={PropertyDetailPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/test" component={TestDashboardPage} />
        <Route path="/test-email" component={TestEmailPage} />
        <Route path="/test-sms" component={TestSmsPage} />

        {/* Legal Pages */}
        <Route path="/terms-and-conditions" component={TermsAndConditions} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />

        {/* Public Team Page */}
        <Route path="/team" component={TeamPage} />

        {/* CRM Routes */}
        <Route path="/crm" component={CRMDashboard} />
        <Route path="/crm/login" component={CRMLogin} />
        <Route path="/crm/dashboard" component={CRMDashboard} />
        <Route path="/crm/properties/create" component={PropertyCreate} />
        <Route path="/crm/properties/import" component={PropertyImport} />
        <Route path="/crm/properties/:id/edit" component={PropertyEdit} />
        <Route path="/crm/properties" component={CRMDashboard} />
        <Route path="/crm/workflows" component={WorkflowManagement} />
        <Route path="/crm/property-management" component={PropertyManagement} />
        <Route path="/crm/voice-agent" component={VoiceAgentDashboard} />
        <Route path="/crm/users" component={UserManagement} />
        <Route path="/crm/communications" component={CommunicationHub} />
        <Route path="/crm/analytics" component={AnalyticsDashboard} />
        <Route path="/crm/syndication" component={PropertySyndication} />
        <Route path="/crm/calendar" component={CalendarIntegration} />
        <Route path="/crm/reports" component={ReportBuilder} />
        <ProtectedRoute path="/crm/staff">
          <StaffManagement />
        </ProtectedRoute>
        <Route path="/crm/integrations">
          <ClearanceProtectedRoute requiredClearance={9} featureKey="integrations" showAccessDenied={true}>
            <IntegrationsSettings />
          </ClearanceProtectedRoute>
        </Route>
        <Route path="/crm/agents" component={AgentSettings} />
        <Route path="/crm/lead-generation" component={LeadGeneration} />
        <Route path="/crm/leads" component={LeadManagement} />
        <Route path="/crm/website-leads" component={WebsiteLeads} />
        <Route path="/crm/landlord-lead-pipeline" component={LandlordLeadPipeline} />
        <Route path="/crm/landlord-lead/:id" component={LandlordLeadDetails} />
        <Route path="/crm/ai-agents" component={AIAgentDashboard} />
        <Route path="/crm/landlords" component={LandlordManagement} />
        <Route path="/crm/landlords/:id" component={LandlordDetails} />
        <Route path="/crm/landlords/:id/properties" component={LandlordProperties} />
        <Route path="/crm/tenants" component={TenantManagement} />
        <Route path="/crm/contacts" component={ContactManagement} />
        <Route path="/crm/contacts/:id" component={ContactManagement} />
        <Route path="/crm/rental-agreements" component={RentalAgreements} />
        <Route path="/crm/support-tickets" component={SupportTickets} />
        <Route path="/crm/compliance" component={ComplianceReference} />
        <Route path="/crm/onboarding/landlord" component={LandlordOnboarding} />
        <Route path="/crm/onboarding/tenant" component={TenantOnboarding} />
        <Route path="/crm/onboarding/property" component={PropertyOnboarding} />
        <Route path="/crm/managed-property/:id" component={ManagedPropertyCard} />
        <Route path="/crm/sales-progression" component={SalesProgressionPage} />
        <Route path="/crm/contractors" component={ContractorManagement} />
        <Route path="/crm/tenant/:id" component={TenantDetails} />
        <Route path="/crm/security-matrix">
          <ClearanceProtectedRoute requiredClearance={10} featureKey="security_matrix" showAccessDenied={true}>
            <SecurityMatrix />
          </ClearanceProtectedRoute>
        </Route>

        {/* CMS Routes */}
        <Route path="/crm/cms">
          <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
            <CMSManagement />
          </ClearanceProtectedRoute>
        </Route>
        <Route path="/crm/cms/pages/:slug">
          <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
            <CMSPageEditor />
          </ClearanceProtectedRoute>
        </Route>
        <Route path="/crm/cms/media">
          <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
            <CMSMediaLibrary />
          </ClearanceProtectedRoute>
        </Route>
        <Route path="/crm/cms/team">
          <ClearanceProtectedRoute requiredClearance={7} featureKey="team_page_edit" showAccessDenied={true}>
            <TeamPageSettings />
          </ClearanceProtectedRoute>
        </Route>

        {/* User Account Routes */}
        <Route path="/login" component={Login} />
        <Route path="/portal" component={Portal} />
        <Route path="/portal/dashboard" component={CRMDashboard} />
        <Route path="/portal/properties" component={CRMDashboard} />
        <Route path="/portal/my-properties" component={CRMDashboard} />
        <Route path="/portal/property-management" component={PropertyManagement} />
        <Route path="/portal/maintenance" component={TenantPortal} />
        <Route path="/portal/maintenance/new" component={TenantPortal} />
        <Route path="/portal/favorites-lists" component={PropertyListingsPage} />
        <Route path="/payments" component={PaymentPage} />
        <Route path="/tenant-portal" component={TenantPortal} />
        <Route path="/dashboard" component={UserDashboard} />

        {/* Specific Area Pages */}
        <Route path="/areas/bayswater" component={BayswaterPage} />
        <Route path="/areas/harlesden" component={HarlesdenPage} />
        <Route path="/areas/kensal-green" component={KensalGreenPage} />
        <Route path="/areas/kensal-rise" component={KensalRisePage} />
        <Route path="/areas/kilburn" component={KilburnPage} />
        <Route path="/areas/ladbroke-grove" component={LabdrokeGrovePage} />
        <Route path="/areas/maida-vale" component={MaidaValePage} />
        <Route path="/areas/north-kensington" component={NorthKensingtonPage} />
        <Route path="/areas/queens-park" component={QueensParkPage} />
        <Route path="/areas/westbourne-park" component={WestbourneParkPage} />
        <Route path="/areas/willesden" component={WillesdenPage} />

        <ProtectedRoute path="/dashboard">
          <DashboardPage />
        </ProtectedRoute>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

export default App;
