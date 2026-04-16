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
import ContactPage from "@/pages/ContactPage";
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
import LandlordDirectory from "@/pages/LandlordDirectory";
import LandlordProperties from "@/pages/LandlordProperties";
import TenantManagement from "@/pages/TenantManagement";
import RentalAgreements from "@/pages/RentalAgreements";
import SupportTickets from "@/pages/SupportTickets";
import ComplianceReference from "@/pages/ComplianceReference";
import LandlordOnboarding from "@/pages/LandlordOnboarding";
import CorporateOnboarding from "@/pages/CorporateOnboarding";
import TenantOnboarding from "@/pages/TenantOnboarding";
import PropertyOnboarding from "@/pages/PropertyOnboarding";
import ManagedPropertyCard from "@/pages/ManagedPropertyCard";
import LandlordDetails from "@/pages/LandlordDetails";
import TenancyDetails from "@/pages/TenancyDetails";
import ContactManagement from "@/pages/ContactManagement";
import SalesProgressionPage from "@/pages/SalesProgressionPage";
import ContractorManagement from "@/pages/ContractorManagement";
import LandlordLeadPipeline from "@/pages/LandlordLeadPipeline";
import PropertyPipeline from "@/pages/PropertyPipeline";
import LettingsPropertyPipeline from "@/pages/LettingsPropertyPipeline";
import LeadMatches from "@/pages/LeadMatches";
import LandlordLeadDetails from "@/pages/LandlordLeadDetails";
import PropertyImport from "@/pages/PropertyImport";
import TermsAndConditions from "@/pages/TermsAndConditions";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import SecurityMatrix from "@/pages/SecurityMatrix";
import MyDesk from "@/pages/MyDesk";
import DashboardOverview from "@/pages/DashboardOverview";

import CMSManagement from "@/pages/CMSManagement";
import CMSPageEditor from "@/pages/CMSPageEditor";
import CMSMediaLibrary from "@/pages/CMSMediaLibrary";
import TeamPageSettings from "@/pages/TeamPageSettings";
import TeamPage from "@/pages/TeamPage";
import { ProtectedRoute as ClearanceProtectedRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/CRMLayout";

// Finance, Tenant & CRM pages
import InvoiceManagement from "@/pages/InvoiceManagement";
import ArrearsTracker from "@/pages/ArrearsTracker";
import AgentMonitoringDashboard from "@/pages/AgentMonitoringDashboard";
import LandlordStatements from "@/pages/LandlordStatements";
import PortfolioFinancials from "@/pages/PortfolioFinancials";
import RentReviewManager from "@/pages/RentReviewManager";
import TenancyRenewals from "@/pages/TenancyRenewals";
import TaskManager from "@/pages/TaskManager";
import EmailTaskQueue from "@/pages/EmailTaskQueue";
import DocumentReviewQueue from "@/pages/DocumentReviewQueue";
import BankReconciliation from "@/pages/BankReconciliation";
import DirectDebitManagement from "@/pages/DirectDebitManagement";
import SalesInbox from "@/pages/SalesInbox";
import LettingsInbox from "@/pages/LettingsInbox";
import MaintenanceInbox from "@/pages/MaintenanceInbox";
import AdminInbox from "@/pages/AdminInbox";

// PM Workflow Pages
import PMTrackingDashboard from "@/pages/PMTrackingDashboard";
import SalesLettingsDashboard from "@/pages/SalesLettingsDashboard";
import RentCollection from "@/pages/RentCollection";
import DepositManagement from "@/pages/DepositManagement";
import ComplianceCalendar from "@/pages/ComplianceCalendar";
import ViewingsCalendar from "@/pages/ViewingsCalendar";
import TenancyExpiryCalendar from "@/pages/TenancyExpiryCalendar";
import EndOfTenancy from "@/pages/EndOfTenancy";
import InventoryTracking from "@/pages/InventoryTracking";
import CompanySettings from "@/pages/CompanySettings";
import TenancyOnboarding from "@/pages/TenancyOnboarding";
import PropertyKnowledgeBase from "@/pages/PropertyKnowledgeBase";
import DealList from "@/pages/DealList";
import DealTimeline from "@/pages/DealTimeline";
import OffersManagement from "@/pages/OffersManagement";
import PendingStatements from "@/pages/PendingStatements";
import TenantInvoices from "@/pages/TenantInvoices";
import SourcingDashboard from "@/pages/SourcingDashboard";
import CallManagement from "@/pages/CallManagement";
import ClientAccountPage from "@/pages/ClientAccountPage";
import OfficeAccountPage from "@/pages/OfficeAccountPage";
import ReserveAccountsPage from "@/pages/ReserveAccountsPage";
import DepositAccountPage from "@/pages/DepositAccountPage";
import BACSPaymentGeneration from "@/pages/BACSPaymentGeneration";
import ContractorBatchPayments from "@/pages/ContractorBatchPayments";
import BatchReceiptRecording from "@/pages/BatchReceiptRecording";
import LandlordLedger from "@/pages/LandlordLedger";
import TenantRentBook from "@/pages/TenantRentBook";
import RecurringLandlordCharges from "@/pages/RecurringLandlordCharges";
import AccountMaintenance from "@/pages/AccountMaintenance";

// Communications Pages
import LetterTemplateManagement from "@/pages/LetterTemplateManagement";
import ArrearsReminderWorkflow from "@/pages/ArrearsReminderWorkflow";

// Compliance Pages
import UnmanagedComplianceReport from "@/pages/UnmanagedComplianceReport";

// Operational Tool Pages
import KeyManagement from "@/pages/KeyManagement";
import RentCalculator from "@/pages/RentCalculator";
import OccupancyCalculator from "@/pages/OccupancyCalculator";

// Tax & Benefits Pages
import LHABenefitManagement from "@/pages/LHABenefitManagement";
import OverseasTaxManagement from "@/pages/OverseasTaxManagement";
import HMRCRentReport from "@/pages/HMRCRentReport";

// Accounting Pages
import BusinessSettings from "@/pages/BusinessSettings";
import ChartOfAccounts from "@/pages/ChartOfAccounts";
import JournalEntries from "@/pages/JournalEntries";
import GeneralLedger from "@/pages/GeneralLedger";
import TrialBalance from "@/pages/TrialBalance";
import BusinessInvoices from "@/pages/BusinessInvoices";
import PurchaseInvoices from "@/pages/PurchaseInvoices";
import CreditNotes from "@/pages/CreditNotes";
import RecurringTemplates from "@/pages/RecurringTemplates";
import VATReturns from "@/pages/VATReturns";
import ProfitAndLoss from "@/pages/ProfitAndLoss";
import BalanceSheet from "@/pages/BalanceSheet";
import AgedDebtors from "@/pages/AgedDebtors";
import AgedCreditors from "@/pages/AgedCreditors";
import TaxReports from "@/pages/TaxReports";
import AccountingDashboard from "@/pages/AccountingDashboard";
import TaxRates from "@/pages/TaxRates";
import FinancialPeriods from "@/pages/FinancialPeriods";
import PaymentAllocations from "@/pages/PaymentAllocations";

// Phase 9: Advanced Admin pages
import BranchManagement from "@/pages/BranchManagement";
import AMLSanctionCheck from "@/pages/AMLSanctionCheck";
import ArchiveManagement from "@/pages/ArchiveManagement";
import DormantManagement from "@/pages/DormantManagement";
import DepositTransfers from "@/pages/DepositTransfers";
import AccountFinalisation from "@/pages/AccountFinalisation";

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

  // Clean up stuck Radix Dialog overlays on route change
  useEffect(() => {
    document.body.style.pointerEvents = '';
  }, [location]);

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
        <Route path="/contact" component={ContactPage} />
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

        {/* CRM Login - no layout */}
        <Route path="/crm/login" component={CRMLogin} />

        {/* CRM Routes - all wrapped with persistent sidebar layout */}
        <Route path="/crm/tenancy-onboarding"><CRMLayout><TenancyOnboarding /></CRMLayout></Route>
        <Route path="/crm/sl-dashboard"><CRMLayout><SalesLettingsDashboard /></CRMLayout></Route>

        {/* Accounting Routes */}
        <Route path="/crm/accounting/dashboard"><CRMLayout><AccountingDashboard /></CRMLayout></Route>
        <Route path="/crm/accounting/tax-rates"><CRMLayout><TaxRates /></CRMLayout></Route>
        <Route path="/crm/accounting/financial-periods"><CRMLayout><FinancialPeriods /></CRMLayout></Route>
        <Route path="/crm/accounting/payment-allocations"><CRMLayout><PaymentAllocations /></CRMLayout></Route>
        <Route path="/crm/accounting/settings"><CRMLayout><BusinessSettings /></CRMLayout></Route>
        <Route path="/crm/accounting/chart-of-accounts"><CRMLayout><ChartOfAccounts /></CRMLayout></Route>
        <Route path="/crm/accounting/journal-entries"><CRMLayout><JournalEntries /></CRMLayout></Route>
        <Route path="/crm/accounting/general-ledger"><CRMLayout><GeneralLedger /></CRMLayout></Route>
        <Route path="/crm/accounting/trial-balance"><CRMLayout><TrialBalance /></CRMLayout></Route>
        <Route path="/crm/accounting/business-invoices"><CRMLayout><BusinessInvoices /></CRMLayout></Route>
        <Route path="/crm/accounting/purchase-invoices"><CRMLayout><PurchaseInvoices /></CRMLayout></Route>
        <Route path="/crm/accounting/credit-notes"><CRMLayout><CreditNotes /></CRMLayout></Route>
        <Route path="/crm/accounting/recurring-templates"><CRMLayout><RecurringTemplates /></CRMLayout></Route>
        <Route path="/crm/accounting/vat-returns"><CRMLayout><VATReturns /></CRMLayout></Route>
        <Route path="/crm/accounting/reports/profit-and-loss"><CRMLayout><ProfitAndLoss /></CRMLayout></Route>
        <Route path="/crm/accounting/reports/balance-sheet"><CRMLayout><BalanceSheet /></CRMLayout></Route>
        <Route path="/crm/accounting/reports/aged-debtors"><CRMLayout><AgedDebtors /></CRMLayout></Route>
        <Route path="/crm/accounting/reports/aged-creditors"><CRMLayout><AgedCreditors /></CRMLayout></Route>
        <Route path="/crm/accounting/reports/tax"><CRMLayout><TaxReports /></CRMLayout></Route>

        <Route path="/crm/dashboard"><CRMLayout><CRMDashboard /></CRMLayout></Route>
        <Route path="/crm/properties/create"><CRMLayout><PropertyCreate /></CRMLayout></Route>
        <Route path="/crm/properties/import"><CRMLayout><PropertyImport /></CRMLayout></Route>
        <Route path="/crm/properties/:id/knowledge-base">{(params: any) => <CRMLayout><PropertyKnowledgeBase {...params} /></CRMLayout>}</Route>
        <Route path="/crm/properties/:id/edit">{(params: any) => <CRMLayout><PropertyEdit {...params} /></CRMLayout>}</Route>
        <Route path="/crm/properties/:id">{(params: any) => <CRMLayout><PropertyEdit {...params} /></CRMLayout>}</Route>
        <Route path="/crm/properties"><CRMLayout><CRMDashboard /></CRMLayout></Route>
        <Route path="/crm/workflows"><CRMLayout><WorkflowManagement /></CRMLayout></Route>

        <Route path="/crm/property-management"><CRMLayout><PropertyManagement /></CRMLayout></Route>
        <Route path="/crm/voice-agent"><CRMLayout><VoiceAgentDashboard /></CRMLayout></Route>
        <Route path="/crm/users"><CRMLayout><UserManagement /></CRMLayout></Route>
        <Route path="/crm/communications"><CRMLayout><CommunicationHub /></CRMLayout></Route>
        <Route path="/crm/analytics"><CRMLayout><AnalyticsDashboard /></CRMLayout></Route>
        <Route path="/crm/syndication"><CRMLayout><PropertySyndication /></CRMLayout></Route>
        <Route path="/crm/calendar"><CRMLayout><CalendarIntegration /></CRMLayout></Route>
        <Route path="/crm/my-desk"><CRMLayout><MyDesk /></CRMLayout></Route>
        <Route path="/crm/dashboard-overview">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={8} featureKey="dashboard_overview" showAccessDenied={true}>
              <DashboardOverview />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>
        <Route path="/crm/reports"><CRMLayout><ReportBuilder /></CRMLayout></Route>
        <Route path="/crm/staff">
          <CRMLayout>
            <StaffManagement />
          </CRMLayout>
        </Route>
        <Route path="/crm/integrations">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={9} featureKey="integrations" showAccessDenied={true}>
              <IntegrationsSettings />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>
        <Route path="/crm/agents"><CRMLayout><AgentSettings /></CRMLayout></Route>
        <Route path="/crm/lead-generation"><CRMLayout><LeadGeneration /></CRMLayout></Route>
        <Route path="/crm/leads"><CRMLayout><LeadManagement /></CRMLayout></Route>
        <Route path="/crm/website-leads"><CRMLayout><WebsiteLeads /></CRMLayout></Route>
        <Route path="/crm/landlord-lead-pipeline"><CRMLayout><LandlordLeadPipeline /></CRMLayout></Route>
        <Route path="/crm/property-pipeline"><CRMLayout><PropertyPipeline /></CRMLayout></Route>
        <Route path="/crm/lettings-property-pipeline"><CRMLayout><LettingsPropertyPipeline /></CRMLayout></Route>
        <Route path="/crm/lead-matches"><CRMLayout><LeadMatches /></CRMLayout></Route>
        <Route path="/crm/landlord-lead/:id">{(params: any) => <CRMLayout><LandlordLeadDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/ai-agents"><CRMLayout><AIAgentDashboard /></CRMLayout></Route>
        <Route path="/crm/landlord-directory"><CRMLayout><LandlordDirectory /></CRMLayout></Route>
        <Route path="/crm/landlords"><CRMLayout><LandlordManagement /></CRMLayout></Route>
        <Route path="/crm/landlords/:id">{(params: any) => <CRMLayout><LandlordDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/landlords/:id/properties">{(params: any) => <CRMLayout><LandlordProperties {...params} /></CRMLayout>}</Route>
        <Route path="/crm/tenants/:id/tickets">{(params: any) => <CRMLayout><TenantDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/tenants/:id">{(params: any) => <CRMLayout><TenantDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/tenants"><CRMLayout><TenantManagement /></CRMLayout></Route>
        <Route path="/crm/contacts"><CRMLayout><ContactManagement /></CRMLayout></Route>
        <Route path="/crm/contacts/:id">{(params: any) => <CRMLayout><ContactManagement {...params} /></CRMLayout>}</Route>
        <Route path="/crm/rental-agreements"><CRMLayout><RentalAgreements /></CRMLayout></Route>
        <Route path="/crm/tenancies/:id">{(params: any) => <CRMLayout><TenancyDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/support-tickets"><CRMLayout><SupportTickets /></CRMLayout></Route>
        <Route path="/crm/compliance/unmanaged"><CRMLayout><UnmanagedComplianceReport /></CRMLayout></Route>
        <Route path="/crm/compliance"><CRMLayout><ComplianceReference /></CRMLayout></Route>
        <Route path="/crm/onboarding/landlord"><CRMLayout><LandlordOnboarding /></CRMLayout></Route>
        <Route path="/crm/onboarding/corporate"><CRMLayout><CorporateOnboarding /></CRMLayout></Route>
        <Route path="/crm/onboarding/tenant"><CRMLayout><TenantOnboarding /></CRMLayout></Route>
        <Route path="/crm/onboarding/property"><CRMLayout><PropertyOnboarding /></CRMLayout></Route>
        <Route path="/crm/managed-property/:id">{(params: any) => <CRMLayout><ManagedPropertyCard {...params} /></CRMLayout>}</Route>
        <Route path="/crm/sales-progression"><CRMLayout><SalesProgressionPage /></CRMLayout></Route>
        <Route path="/crm/contractors"><CRMLayout><ContractorManagement /></CRMLayout></Route>
        <Route path="/crm/invoices"><CRMLayout><InvoiceManagement /></CRMLayout></Route>
        <Route path="/crm/business-invoices"><CRMLayout><InvoiceManagement /></CRMLayout></Route>
        <Route path="/crm/arrears"><CRMLayout><ArrearsTracker /></CRMLayout></Route>
        <Route path="/crm/statements"><CRMLayout><LandlordStatements /></CRMLayout></Route>
        <Route path="/crm/financials"><CRMLayout><PortfolioFinancials /></CRMLayout></Route>
        <Route path="/crm/rent-reviews"><CRMLayout><RentReviewManager /></CRMLayout></Route>
        <Route path="/crm/tenancy-renewals"><CRMLayout><TenancyRenewals /></CRMLayout></Route>
        <Route path="/crm/task-manager"><CRMLayout><TaskManager /></CRMLayout></Route>
        <Route path="/crm/email-task-queue"><CRMLayout><EmailTaskQueue /></CRMLayout></Route>
        <Route path="/crm/document-review"><CRMLayout><DocumentReviewQueue /></CRMLayout></Route>
        <Route path="/crm/bank-reconciliation"><CRMLayout><BankReconciliation /></CRMLayout></Route>
        <Route path="/crm/direct-debits"><CRMLayout><DirectDebitManagement /></CRMLayout></Route>
        <Route path="/crm/inbox/sales"><CRMLayout><SalesInbox /></CRMLayout></Route>
        <Route path="/crm/inbox/lettings"><CRMLayout><LettingsInbox /></CRMLayout></Route>
        <Route path="/crm/inbox/maintenance"><CRMLayout><MaintenanceInbox /></CRMLayout></Route>
        <Route path="/crm/inbox/admin"><CRMLayout><AdminInbox /></CRMLayout></Route>
        <Route path="/crm/pm-dashboard"><CRMLayout><PMTrackingDashboard /></CRMLayout></Route>
        <Route path="/crm/rent-collection"><CRMLayout><RentCollection /></CRMLayout></Route>
        <Route path="/crm/deposit-management"><CRMLayout><DepositManagement /></CRMLayout></Route>
        <Route path="/crm/compliance-calendar"><CRMLayout><ComplianceCalendar /></CRMLayout></Route>
        <Route path="/crm/viewings-calendar"><CRMLayout><ViewingsCalendar /></CRMLayout></Route>
        <Route path="/crm/tenancy-expiry-calendar"><CRMLayout><TenancyExpiryCalendar /></CRMLayout></Route>
        <Route path="/crm/end-of-tenancy"><CRMLayout><EndOfTenancy /></CRMLayout></Route>
        <Route path="/crm/inventory"><CRMLayout><InventoryTracking /></CRMLayout></Route>
        <Route path="/crm/company-settings"><CRMLayout><CompanySettings /></CRMLayout></Route>
        <Route path="/crm/tenant/:id">{(params: any) => <CRMLayout><TenantDetails {...params} /></CRMLayout>}</Route>
        <Route path="/crm/security-matrix">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={10} featureKey="security_matrix" showAccessDenied={true}>
              <SecurityMatrix />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>

        {/* CMS Routes */}
        <Route path="/crm/cms">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
              <CMSManagement />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>
        <Route path="/crm/cms/pages/:slug">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
              <CMSPageEditor />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>
        <Route path="/crm/cms/media">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={5} featureKey="cms_view" showAccessDenied={true}>
              <CMSMediaLibrary />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>
        <Route path="/crm/cms/team">
          <CRMLayout>
            <ClearanceProtectedRoute requiredClearance={7} featureKey="team_page_edit" showAccessDenied={true}>
              <TeamPageSettings />
            </ClearanceProtectedRoute>
          </CRMLayout>
        </Route>

        <Route path="/crm/agent-monitoring"><CRMLayout><AgentMonitoringDashboard /></CRMLayout></Route>

        {/* Deal Lifecycle Routes */}
        <Route path="/crm/deals/:id">{(params: any) => <CRMLayout><DealTimeline {...params} /></CRMLayout>}</Route>
        <Route path="/crm/deals"><CRMLayout><DealList /></CRMLayout></Route>

        {/* Offers Management */}
        <Route path="/crm/offers"><CRMLayout><OffersManagement /></CRMLayout></Route>

        {/* Finance Agent Pages */}
        <Route path="/crm/finance/statements"><CRMLayout><PendingStatements /></CRMLayout></Route>
        <Route path="/crm/finance/invoices"><CRMLayout><TenantInvoices /></CRMLayout></Route>

        {/* Property Sourcing */}
        <Route path="/crm/sourcing-dashboard"><CRMLayout><SourcingDashboard /></CRMLayout></Route>

        {/* Call Management */}
        <Route path="/crm/call-management"><CRMLayout><CallManagement /></CRMLayout></Route>

        {/* Account Management Pages */}
        <Route path="/crm/client-account"><CRMLayout><ClientAccountPage /></CRMLayout></Route>
        <Route path="/crm/office-account"><CRMLayout><OfficeAccountPage /></CRMLayout></Route>
        <Route path="/crm/reserve-accounts"><CRMLayout><ReserveAccountsPage /></CRMLayout></Route>
        <Route path="/crm/deposit-account"><CRMLayout><DepositAccountPage /></CRMLayout></Route>
        <Route path="/crm/bacs-payments"><CRMLayout><BACSPaymentGeneration /></CRMLayout></Route>
        <Route path="/crm/contractor-batch"><CRMLayout><ContractorBatchPayments /></CRMLayout></Route>
        <Route path="/crm/batch-receipts"><CRMLayout><BatchReceiptRecording /></CRMLayout></Route>

        {/* Ledger & Finance Tools */}
        <Route path="/crm/landlord-ledger"><CRMLayout><LandlordLedger /></CRMLayout></Route>
        <Route path="/crm/tenant-rent-book"><CRMLayout><TenantRentBook /></CRMLayout></Route>
        <Route path="/crm/recurring-charges"><CRMLayout><RecurringLandlordCharges /></CRMLayout></Route>
        <Route path="/crm/account-maintenance"><CRMLayout><AccountMaintenance /></CRMLayout></Route>

        {/* Communications Routes */}
        <Route path="/crm/letter-templates"><CRMLayout><LetterTemplateManagement /></CRMLayout></Route>
        <Route path="/crm/arrears-reminders"><CRMLayout><ArrearsReminderWorkflow /></CRMLayout></Route>

        {/* Tax & Benefits Routes */}
        <Route path="/crm/lha-benefits"><CRMLayout><LHABenefitManagement /></CRMLayout></Route>
        <Route path="/crm/overseas-tax"><CRMLayout><OverseasTaxManagement /></CRMLayout></Route>
        <Route path="/crm/hmrc-report"><CRMLayout><HMRCRentReport /></CRMLayout></Route>

        {/* Operational Tool Pages */}
        <Route path="/crm/key-management"><CRMLayout><KeyManagement /></CRMLayout></Route>
        <Route path="/crm/rent-calculator"><CRMLayout><RentCalculator /></CRMLayout></Route>
        <Route path="/crm/occupancy"><CRMLayout><OccupancyCalculator /></CRMLayout></Route>

        {/* CRM catch-all — MUST be the last /crm route (wouter matches top-to-bottom) */}
        {/* Phase 9: Advanced Admin routes */}
        <Route path="/crm/branches"><CRMLayout><BranchManagement /></CRMLayout></Route>
        <Route path="/crm/aml-checks"><CRMLayout><AMLSanctionCheck /></CRMLayout></Route>
        <Route path="/crm/archives"><CRMLayout><ArchiveManagement /></CRMLayout></Route>
        <Route path="/crm/dormant"><CRMLayout><DormantManagement /></CRMLayout></Route>
        <Route path="/crm/deposit-transfers"><CRMLayout><DepositTransfers /></CRMLayout></Route>
        <Route path="/crm/account-finalisation"><CRMLayout><AccountFinalisation /></CRMLayout></Route>

        <Route path="/crm"><CRMLayout><MyDesk /></CRMLayout></Route>

        {/* User Account Routes */}
        <Route path="/login" component={Login} />
        <Route path="/portal" component={Portal} />
        <Route path="/portal/dashboard" component={CRMDashboard} />
        <Route path="/portal/properties" component={CRMDashboard} />
        <Route path="/portal/my-properties" component={CRMDashboard} />
        <Route path="/portal/property-management" component={PropertyManagement} />
        <Route path="/portal/my-property" component={TenantPortal} />
        <Route path="/portal/maintenance" component={TenantPortal} />
        <Route path="/portal/maintenance/new" component={TenantPortal} />
        <Route path="/portal/favorites-lists" component={PropertyListingsPage} />
        <Route path="/portal/payments" component={PaymentPage} />
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
