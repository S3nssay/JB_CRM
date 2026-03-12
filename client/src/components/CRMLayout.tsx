import { useState, useEffect, type ReactNode } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImportKeyDataDialog } from '@/components/ImportKeyDataDialog';
import {
  Building2, Users, Home, Wrench, BarChart3,
  Settings, LogOut, Bell, GitBranch, Mic, Shield,
  ArrowLeft, User, Gavel, Lock, UserPlus,
  LayoutGrid, Key, UserCircle, HardHat, FileUp,
  Receipt, AlertTriangle, FileSpreadsheet, TrendingUp,
  RotateCcw, CalendarClock, Send, CheckSquare,
  CreditCard, ArrowRightLeft, Mail,
  Gauge, PoundSterling, ShieldCheck, Calendar, ClipboardList, ClipboardCheck, Settings2,
  ChevronDown, ChevronRight as ChevronRightIcon,
  BookOpen, Calculator, Landmark, Scale, FileText, Repeat, FileMinus,
  FolderTree
} from 'lucide-react';

interface CRMLayoutProps {
  children: ReactNode;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [showImportKeyDataDialog, setShowImportKeyDataDialog] = useState(false);
  const [pmExpanded, setPmExpanded] = useState(true);
  const [salesExpanded, setSalesExpanded] = useState(true);
  const [accountingExpanded, setAccountingExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setLocation('/crm/login');
    }
  }, []);

  // Fetch landlord leads for badge counts
  const { data: landlordLeads = [] } = useQuery({
    queryKey: ['/api/crm/landlord-leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch buyer/renter leads for badge counts
  const { data: buyerRenterLeads = [] } = useQuery({
    queryKey: ['/api/crm/leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/leads', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  const newLandlordLeadsCount = landlordLeads.filter((l: any) => l.workflow_stage === 'new' || !l.workflow_stage).length;
  const newBuyerRenterLeadsCount = buyerRenterLeads.filter((l: any) => l.status === 'new').length;

  // Fetch unread email counts for department inboxes
  const { data: mailboxCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['/api/email-integration/system-mailbox-counts'],
    queryFn: async () => {
      const response = await fetch('/api/email-integration/system-mailbox-counts', { credentials: 'include' });
      if (!response.ok) return {};
      return response.json();
    },
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    setLocation('/crm/login');
  };

  // Determine which sidebar item is active based on current route
  const isActive = (path: string) => location === path;
  const isActivePrefix = (prefix: string) => location.startsWith(prefix) && location !== '/crm';

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#791E75] border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <Building2 className="h-8 w-8 text-[#F8B324]600 mr-3" />
              <h1 className="text-xl font-semibold">John Barclay CRM</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{user?.fullName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-60 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 h-[calc(100vh-4rem)] overflow-y-auto sticky top-16 flex-shrink-0">
          <nav className="py-3 px-2">
            {/* Top nav items */}
            <div className="space-y-0.5">
              <button
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive('/crm') || isActive('/crm/dashboard') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setLocation('/crm')}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                Overview
              </button>
              <button
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive('/crm/my-desk') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setLocation('/crm/my-desk')}
              >
                <UserCircle className="h-4 w-4 flex-shrink-0" />
                My Desk
              </button>
              {(user?.role === 'admin' || (user?.securityClearance && user.securityClearance >= 8)) && (
                <button
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive('/crm/dashboard-overview') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => setLocation('/crm/dashboard-overview')}
                >
                  <LayoutGrid className="h-4 w-4 flex-shrink-0" />
                  Management Dashboard
                </button>
              )}
            </div>

            {/* Communication & Tools Section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-[11px] font-semibold text-[#791E75] uppercase tracking-wider mb-1.5 px-3">
                Communication
              </p>
              <div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/task-manager') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/task-manager')}>
                  <CheckSquare className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/task-manager') ? 'text-white' : 'text-gray-400'}`} />
                  Task Manager
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/email-task-queue') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/email-task-queue')}>
                  <ClipboardList className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/email-task-queue') ? 'text-white' : 'text-gray-400'}`} />
                  Email Task Queue
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/document-review') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/document-review')}>
                  <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/document-review') ? 'text-white' : 'text-gray-400'}`} />
                  Document Review
                </button>

                {/* Email Inboxes sub-group */}
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                  Email Inboxes
                </p>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/inbox/sales') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/inbox/sales')}>
                  <Mail className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/inbox/sales') ? 'text-white' : 'text-blue-400'}`} />
                  Sales
                  {(mailboxCounts.sales || 0) > 0 && (
                    <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {mailboxCounts.sales > 99 ? '99+' : mailboxCounts.sales}
                    </span>
                  )}
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/inbox/lettings') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/inbox/lettings')}>
                  <Mail className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/inbox/lettings') ? 'text-white' : 'text-purple-400'}`} />
                  Lettings
                  {(mailboxCounts.lettings || 0) > 0 && (
                    <span className="ml-auto bg-purple-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {mailboxCounts.lettings > 99 ? '99+' : mailboxCounts.lettings}
                    </span>
                  )}
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/inbox/maintenance') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/inbox/maintenance')}>
                  <Mail className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/inbox/maintenance') ? 'text-white' : 'text-orange-400'}`} />
                  Maintenance
                  {(mailboxCounts.maintenance || 0) > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {mailboxCounts.maintenance > 99 ? '99+' : mailboxCounts.maintenance}
                    </span>
                  )}
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/inbox/admin') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/inbox/admin')}>
                  <Mail className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/inbox/admin') ? 'text-white' : 'text-gray-500'}`} />
                  Admin
                  {(mailboxCounts.admin || 0) > 0 && (
                    <span className="ml-auto bg-gray-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {mailboxCounts.admin > 99 ? '99+' : mailboxCounts.admin}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Property Management Section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                className="w-full flex items-center justify-between px-3 mb-1.5 group"
                onClick={() => setPmExpanded(!pmExpanded)}
              >
                <p className="text-[11px] font-semibold text-[#791E75] uppercase tracking-wider">
                  Property Management
                </p>
                {pmExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" />}
              </button>
              {pmExpanded && <div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/pm-dashboard') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/pm-dashboard')}>
                  <Gauge className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/pm-dashboard') ? 'text-white' : 'text-gray-400'}`} />
                  PM Command Centre
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/landlord-directory') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/landlord-directory')}>
                  <FolderTree className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/landlord-directory') ? 'text-white' : 'text-gray-400'}`} />
                  Landlords
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/rental-agreements') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/rental-agreements')}>
                  <Key className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/rental-agreements') ? 'text-white' : 'text-gray-400'}`} />
                  Tenancies
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/property-management') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/property-management')}>
                  <Home className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/property-management') ? 'text-white' : 'text-gray-400'}`} />
                  Managed Properties
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActivePrefix('/crm/tenant') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/tenants')}>
                  <Users className={`h-3.5 w-3.5 flex-shrink-0 ${isActivePrefix('/crm/tenant') ? 'text-white' : 'text-gray-400'}`} />
                  Tenants
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/contractors') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/contractors')}>
                  <HardHat className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/contractors') ? 'text-white' : 'text-gray-400'}`} />
                  Contractors
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActivePrefix('/crm/contacts') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/contacts')}>
                  <Users className={`h-3.5 w-3.5 flex-shrink-0 ${isActivePrefix('/crm/contacts') ? 'text-white' : 'text-gray-400'}`} />
                  Contacts
                </button>
                <button
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/support-tickets') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                  onClick={() => setLocation('/crm/support-tickets')}
                >
                  <Wrench className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/support-tickets') ? 'text-white' : 'text-gray-400'}`} />
                  Support Tickets
                </button>

                {/* Finance sub-group */}
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                  Finance
                </p>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/invoices') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/invoices')}>
                  <Receipt className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/invoices') ? 'text-white' : 'text-gray-400'}`} />
                  Tenant Invoices
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/arrears') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/arrears')}>
                  <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/arrears') ? 'text-white' : 'text-gray-400'}`} />
                  Arrears
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/statements') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/statements')}>
                  <FileSpreadsheet className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/statements') ? 'text-white' : 'text-gray-400'}`} />
                  Landlord Statements
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/financials') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/financials')}>
                  <TrendingUp className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/financials') ? 'text-white' : 'text-gray-400'}`} />
                  Portfolio Financials
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/rent-reviews') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/rent-reviews')}>
                  <RotateCcw className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/rent-reviews') ? 'text-white' : 'text-gray-400'}`} />
                  Rent Reviews
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/bank-reconciliation') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/bank-reconciliation')}>
                  <ArrowRightLeft className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/bank-reconciliation') ? 'text-white' : 'text-gray-400'}`} />
                  Bank Reconciliation
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/direct-debits') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/direct-debits')}>
                  <CreditCard className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/direct-debits') ? 'text-white' : 'text-gray-400'}`} />
                  Direct Debits
                </button>

                {/* PM Workflows sub-group */}
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                  PM Workflows
                </p>

                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/tenancy-onboarding') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/tenancy-onboarding')}>
                  <ClipboardCheck className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/tenancy-onboarding') ? 'text-white' : 'text-gray-400'}`} />
                  Tenancy Onboarding
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/rent-collection') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/rent-collection')}>
                  <PoundSterling className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/rent-collection') ? 'text-white' : 'text-gray-400'}`} />
                  Rent Collection
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/deposit-management') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/deposit-management')}>
                  <ShieldCheck className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/deposit-management') ? 'text-white' : 'text-gray-400'}`} />
                  Deposits
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/compliance-calendar') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/compliance-calendar')}>
                  <Calendar className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/compliance-calendar') ? 'text-white' : 'text-gray-400'}`} />
                  Compliance Calendar
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/viewings-calendar') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/viewings-calendar')}>
                  <Calendar className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/viewings-calendar') ? 'text-white' : 'text-gray-400'}`} />
                  Viewings Calendar
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/tenancy-expiry-calendar') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/tenancy-expiry-calendar')}>
                  <CalendarClock className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/tenancy-expiry-calendar') ? 'text-white' : 'text-gray-400'}`} />
                  Tenancy Expiry Calendar
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/tenancy-renewals') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/tenancy-renewals')}>
                  <CalendarClock className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/tenancy-renewals') ? 'text-white' : 'text-gray-400'}`} />
                  Tenancy Renewals
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/end-of-tenancy') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/end-of-tenancy')}>
                  <ClipboardList className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/end-of-tenancy') ? 'text-white' : 'text-gray-400'}`} />
                  End of Tenancy
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/inventory') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/inventory')}>
                  <ClipboardCheck className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/inventory') ? 'text-white' : 'text-gray-400'}`} />
                  Inventory
                </button>
              </div>}
            </div>

            {/* Sales & Lettings Section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                className="w-full flex items-center justify-between px-3 mb-1.5 group"
                onClick={() => setSalesExpanded(!salesExpanded)}
              >
                <p className="text-[11px] font-semibold text-[#791E75] uppercase tracking-wider">
                  Sales & Lettings
                </p>
                {salesExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" />}
              </button>
              {salesExpanded && <>
              <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/sl-dashboard') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/sl-dashboard')}>
                <Gauge className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/sl-dashboard') ? 'text-white' : 'text-gray-400'}`} />
                S&L Command Centre
              </button>
              {/* Listings */}
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-1">
                Listings
              </p>
              <div className="space-y-0.5">
                <button
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/properties') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                  onClick={() => setLocation('/crm')}
                >
                  <Home className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/properties') ? 'text-white' : 'text-gray-400'}`} />
                  All Properties
                </button>
                <button
                  className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1 rounded-lg text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                  onClick={() => setLocation('/crm')}
                >
                  Residential Sales
                </button>
                <button
                  className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1 rounded-lg text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                  onClick={() => setLocation('/crm')}
                >
                  Residential Lettings
                </button>
                <button
                  className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1 rounded-lg text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                  onClick={() => setLocation('/crm')}
                >
                  Commercial Sales
                </button>
                <button
                  className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1 rounded-lg text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                  onClick={() => setLocation('/crm')}
                >
                  Commercial Lettings
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/sales-progression') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/sales-progression')}>
                  <Gavel className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/sales-progression') ? 'text-white' : 'text-gray-400'}`} />
                  Sales Progression
                </button>
              </div>

              {/* Finance */}
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                Finance
              </p>
              <div className="space-y-0.5">

              </div>

              {/* Leads */}
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                Leads
              </p>
              <div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/landlord-lead-pipeline') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/landlord-lead-pipeline')}>
                  <GitBranch className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/landlord-lead-pipeline') ? 'text-white' : 'text-gray-400'}`} />
                  Lead Pipeline
                  {newLandlordLeadsCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {newLandlordLeadsCount > 99 ? '99+' : newLandlordLeadsCount}
                    </span>
                  )}
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/property-pipeline') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/property-pipeline')}>
                  <GitBranch className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/property-pipeline') ? 'text-white' : 'text-gray-400'}`} />
                  Property Pipeline
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${isActive('/crm/leads') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/leads')}>
                  <Users className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/leads') ? 'text-white' : 'text-gray-400'}`} />
                  Buyer/Renter Leads
                  {newBuyerRenterLeadsCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {newBuyerRenterLeadsCount > 99 ? '99+' : newBuyerRenterLeadsCount}
                    </span>
                  )}
                </button>
              </div>
              </>}
            </div>

            {/* Accounting Section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                className="w-full flex items-center justify-between px-3 mb-1.5 group"
                onClick={() => setAccountingExpanded(!accountingExpanded)}
              >
                <p className="text-[11px] font-semibold text-[#791E75] uppercase tracking-wider">
                  Accounting
                </p>
                {accountingExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" />}
              </button>
              {accountingExpanded && <><div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/settings') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/settings')}>
                  <Settings2 className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/settings') ? 'text-white' : 'text-gray-400'}`} />
                  Business Settings
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/chart-of-accounts') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/chart-of-accounts')}>
                  <BookOpen className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/chart-of-accounts') ? 'text-white' : 'text-gray-400'}`} />
                  Chart of Accounts
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/journal-entries') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/journal-entries')}>
                  <FileSpreadsheet className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/journal-entries') ? 'text-white' : 'text-gray-400'}`} />
                  Journal Entries
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/general-ledger') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/general-ledger')}>
                  <Landmark className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/general-ledger') ? 'text-white' : 'text-gray-400'}`} />
                  General Ledger
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/trial-balance') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/trial-balance')}>
                  <Scale className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/trial-balance') ? 'text-white' : 'text-gray-400'}`} />
                  Trial Balance
                </button>
              </div>

              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                Invoicing
              </p>
              <div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/business-invoices') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/business-invoices')}>
                  <Receipt className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/business-invoices') ? 'text-white' : 'text-gray-400'}`} />
                  Sales Invoices
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/purchase-invoices') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/purchase-invoices')}>
                  <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/purchase-invoices') ? 'text-white' : 'text-gray-400'}`} />
                  Purchase Invoices
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/credit-notes') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/credit-notes')}>
                  <FileMinus className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/credit-notes') ? 'text-white' : 'text-gray-400'}`} />
                  Credit Notes
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/recurring-templates') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/recurring-templates')}>
                  <Repeat className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/recurring-templates') ? 'text-white' : 'text-gray-400'}`} />
                  Recurring Templates
                </button>
              </div>

              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 px-3 mt-2">
                Tax & Reports
              </p>
              <div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/vat-returns') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/vat-returns')}>
                  <Calculator className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/vat-returns') ? 'text-white' : 'text-gray-400'}`} />
                  VAT Returns
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/reports/profit-and-loss') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/reports/profit-and-loss')}>
                  <TrendingUp className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/reports/profit-and-loss') ? 'text-white' : 'text-gray-400'}`} />
                  Profit & Loss
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/reports/balance-sheet') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/reports/balance-sheet')}>
                  <BarChart3 className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/reports/balance-sheet') ? 'text-white' : 'text-gray-400'}`} />
                  Balance Sheet
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/reports/aged-debtors') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/reports/aged-debtors')}>
                  <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/reports/aged-debtors') ? 'text-white' : 'text-gray-400'}`} />
                  Aged Debtors
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/reports/aged-creditors') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/reports/aged-creditors')}>
                  <CreditCard className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/reports/aged-creditors') ? 'text-white' : 'text-gray-400'}`} />
                  Aged Creditors
                </button>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/accounting/reports/tax') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/accounting/reports/tax')}>
                  <ShieldCheck className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/accounting/reports/tax') ? 'text-white' : 'text-gray-400'}`} />
                  Tax Reports
                </button>
              </div>
              </>}
            </div>

            {/* Admin Section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                className="w-full flex items-center justify-between px-3 mb-1.5 group"
                onClick={() => setAdminExpanded(!adminExpanded)}
              >
                <p className="text-[11px] font-semibold text-[#791E75] uppercase tracking-wider">
                  Admin
                </p>
                {adminExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#791E75]" />}
              </button>
              {adminExpanded && <><div className="space-y-0.5">
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/integrations') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/integrations')}>
                  <Settings className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/integrations') ? 'text-white' : 'text-gray-400'}`} />
                  Settings
                </button>
                {(user?.role === 'admin' || (user?.securityClearance && user.securityClearance >= 8)) && (
                  <>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/users') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/users')}>
                      <Shield className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/users') ? 'text-white' : 'text-gray-400'}`} />
                      User Management
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/workflows') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/workflows')}>
                      <GitBranch className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/workflows') ? 'text-white' : 'text-gray-400'}`} />
                      Workflows
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/staff') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/staff')}>
                      <Users className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/staff') ? 'text-white' : 'text-gray-400'}`} />
                      Staff
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/voice-agent') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/voice-agent')}>
                      <Mic className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/voice-agent') ? 'text-white' : 'text-gray-400'}`} />
                      Voice Agent
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/security-matrix') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/security-matrix')}>
                      <Lock className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/security-matrix') ? 'text-white' : 'text-gray-400'}`} />
                      Security Matrix
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${isActive('/crm/business-invoices') ? 'bg-[#791E75] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/business-invoices')}>
                      <Receipt className={`h-3.5 w-3.5 flex-shrink-0 ${isActive('/crm/business-invoices') ? 'text-white' : 'text-gray-400'}`} />
                      Business Invoices
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all" onClick={() => setShowImportKeyDataDialog(true)}>
                      <FileUp className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      Import Data
                    </button>
                  </>
                )}
              </div>

              {/* SETTINGS */}
              <div className="mt-2 pt-2 border-t">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
                <button className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${location === '/crm/company-settings' ? 'bg-[#791E75]/10 text-[#791E75] font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`} onClick={() => setLocation('/crm/company-settings')}>
                  <Settings2 className="h-3.5 w-3.5 flex-shrink-0" />
                  Company Settings
                </button>
              </div>
              </>}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>

      {/* Import Key Data Dialog */}
      <ImportKeyDataDialog
        open={showImportKeyDataDialog}
        onOpenChange={setShowImportKeyDataDialog}
      />
    </div>
  );
}
