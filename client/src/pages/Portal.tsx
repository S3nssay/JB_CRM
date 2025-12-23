import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Users, Home, Wrench, Calendar, BarChart3,
  Settings, LogOut, Bell, MessageSquare, Share2, DollarSign,
  FileText, Shield, GitBranch, Mic, Globe, Mail, Plus,
  Eye, CreditCard, Key, User, ChevronRight
} from 'lucide-react';

// Menu configuration by role
const menuConfig = {
  admin: [
    {
      category: 'Property Management',
      items: [
        { label: 'Dashboard', icon: BarChart3, path: '/portal/dashboard', description: 'Overview and KPIs' },
        { label: 'All Properties', icon: Home, path: '/portal/properties', description: 'Sales & rentals listings' },
        { label: 'Rental Management', icon: Key, path: '/portal/property-management', description: 'Tenants & maintenance' },
        { label: 'Property Syndication', icon: Globe, path: '/crm/syndication', description: 'Portal publishing' },
      ]
    },
    {
      category: 'Communications',
      items: [
        { label: 'Communication Hub', icon: Mail, path: '/crm/communications', description: 'Unified inbox' },
        { label: 'Calendar', icon: Calendar, path: '/crm/calendar', description: 'Viewings & events' },
      ]
    },
    {
      category: 'Operations',
      items: [
        { label: 'Maintenance', icon: Wrench, path: '/portal/maintenance', description: 'Tickets & repairs' },
        { label: 'Payments', icon: CreditCard, path: '/payments', description: 'Rent & invoices' },
      ]
    },
    {
      category: 'Analytics & Reports',
      items: [
        { label: 'Analytics', icon: BarChart3, path: '/crm/analytics', description: 'Performance metrics' },
        { label: 'Reports', icon: FileText, path: '/crm/reports', description: 'Generate reports' },
      ]
    },
    {
      category: 'Administration',
      items: [
        { label: 'User Management', icon: Users, path: '/crm/users', description: 'Manage staff & users' },
        { label: 'Workflows', icon: GitBranch, path: '/crm/workflows', description: 'Automation rules' },
        { label: 'Voice Agent', icon: Mic, path: '/crm/voice-agent', description: 'AI phone system' },
        { label: 'Settings', icon: Settings, path: '/portal/settings', description: 'System configuration' },
      ]
    }
  ],
  agent: [
    {
      category: 'Property Management',
      items: [
        { label: 'Dashboard', icon: BarChart3, path: '/portal/dashboard', description: 'Your overview' },
        { label: 'All Properties', icon: Home, path: '/portal/properties', description: 'Sales & rentals listings' },
        { label: 'Rental Management', icon: Key, path: '/portal/property-management', description: 'Tenants & maintenance' },
        { label: 'Property Syndication', icon: Globe, path: '/crm/syndication', description: 'Portal publishing' },
      ]
    },
    {
      category: 'Communications',
      items: [
        { label: 'Communication Hub', icon: Mail, path: '/crm/communications', description: 'Messages & enquiries' },
        { label: 'Calendar', icon: Calendar, path: '/crm/calendar', description: 'Viewings & events' },
      ]
    },
    {
      category: 'Operations',
      items: [
        { label: 'Maintenance', icon: Wrench, path: '/portal/maintenance', description: 'Tickets' },
      ]
    },
    {
      category: 'Reports',
      items: [
        { label: 'Analytics', icon: BarChart3, path: '/crm/analytics', description: 'Performance' },
        { label: 'Reports', icon: FileText, path: '/crm/reports', description: 'Generate reports' },
      ]
    }
  ],
  landlord: [
    {
      category: 'My Properties',
      items: [
        { label: 'Dashboard', icon: BarChart3, path: '/portal/dashboard', description: 'Property overview' },
        { label: 'My Properties', icon: Home, path: '/portal/my-properties', description: 'View your properties' },
        { label: 'Tenants', icon: Users, path: '/portal/tenants', description: 'Current tenants' },
      ]
    },
    {
      category: 'Financial',
      items: [
        { label: 'Payments', icon: CreditCard, path: '/payments', description: 'Rent & statements' },
        { label: 'Reports', icon: FileText, path: '/portal/reports', description: 'Financial reports' },
      ]
    },
    {
      category: 'Maintenance',
      items: [
        { label: 'Maintenance Requests', icon: Wrench, path: '/portal/maintenance', description: 'Repair tickets' },
      ]
    },
    {
      category: 'Communication',
      items: [
        { label: 'Messages', icon: MessageSquare, path: '/portal/messages', description: 'Contact agent' },
      ]
    }
  ],
  tenant: [
    {
      category: 'My Tenancy',
      items: [
        { label: 'Dashboard', icon: Home, path: '/portal/dashboard', description: 'Tenancy overview' },
        { label: 'My Property', icon: Building2, path: '/portal/my-property', description: 'Property details' },
      ]
    },
    {
      category: 'Payments',
      items: [
        { label: 'Rent Payments', icon: CreditCard, path: '/payments', description: 'Pay rent & view history' },
        { label: 'Documents', icon: FileText, path: '/portal/documents', description: 'Tenancy agreement' },
      ]
    },
    {
      category: 'Maintenance',
      items: [
        { label: 'Report Issue', icon: Wrench, path: '/portal/maintenance/new', description: 'Submit repair request' },
        { label: 'My Requests', icon: Eye, path: '/portal/maintenance', description: 'Track repairs' },
      ]
    },
    {
      category: 'Communication',
      items: [
        { label: 'Messages', icon: MessageSquare, path: '/portal/messages', description: 'Contact landlord/agent' },
      ]
    }
  ],
  user: [
    {
      category: 'Property Search',
      items: [
        { label: 'Search Properties', icon: Home, path: '/search', description: 'Advanced property search' },
        { label: 'Favorites Lists', icon: Building2, path: '/portal/favorites-lists', description: 'Manage saved properties' },
        { label: 'Email Alerts', icon: Bell, path: '/portal/alerts', description: 'Property notifications' },
        { label: 'Property Profiles', icon: Settings, path: '/portal/property-profiles', description: 'Your search preferences' },
      ]
    },
    {
      category: 'Activity',
      items: [
        { label: 'My Viewings', icon: Calendar, path: '/portal/viewings', description: 'Scheduled viewings' },
        { label: 'My Offers', icon: FileText, path: '/portal/offers', description: 'Property offers' },
        { label: 'Messages', icon: MessageSquare, path: '/portal/messages', description: 'Contact agents' },
      ]
    },
    {
      category: 'Services',
      items: [
        { label: 'Get Valuation', icon: DollarSign, path: '/valuation', description: 'Free property valuation' },
      ]
    },
    {
      category: 'Account',
      items: [
        { label: 'Mailing Lists', icon: Mail, path: '/portal/mailing-lists', description: 'Newsletter subscriptions' },
        { label: 'Preferences', icon: User, path: '/portal/preferences', description: 'Account settings' },
      ]
    }
  ],
  maintenance_staff: [
    {
      category: 'Work Orders',
      items: [
        { label: 'Dashboard', icon: BarChart3, path: '/portal/dashboard', description: 'Today\'s jobs' },
        { label: 'My Jobs', icon: Wrench, path: '/portal/my-jobs', description: 'Assigned tickets' },
        { label: 'All Tickets', icon: FileText, path: '/portal/tickets', description: 'Browse all tickets' },
      ]
    },
    {
      category: 'Schedule',
      items: [
        { label: 'Calendar', icon: Calendar, path: '/crm/calendar', description: 'Job schedule' },
      ]
    }
  ]
};

// Quick action cards by role
const quickActionsConfig = {
  admin: [
    { label: 'Add Property', icon: Plus, path: '/crm/properties/create', color: 'bg-blue-500' },
    { label: 'New Viewing', icon: Calendar, path: '/crm/calendar', color: 'bg-green-500' },
    { label: 'Send Message', icon: Mail, path: '/crm/communications', color: 'bg-purple-500' },
    { label: 'View Reports', icon: BarChart3, path: '/crm/analytics', color: 'bg-yellow-500' },
  ],
  agent: [
    { label: 'Add Property', icon: Plus, path: '/crm/properties/create', color: 'bg-blue-500' },
    { label: 'Schedule Viewing', icon: Calendar, path: '/crm/calendar', color: 'bg-green-500' },
    { label: 'Messages', icon: Mail, path: '/crm/communications', color: 'bg-purple-500' },
  ],
  landlord: [
    { label: 'View Statements', icon: FileText, path: '/portal/payments', color: 'bg-blue-500' },
    { label: 'Maintenance', icon: Wrench, path: '/portal/maintenance', color: 'bg-yellow-500' },
    { label: 'Contact Agent', icon: MessageSquare, path: '/portal/messages', color: 'bg-green-500' },
  ],
  tenant: [
    { label: 'Pay Rent', icon: CreditCard, path: '/portal/payments', color: 'bg-green-500' },
    { label: 'Report Issue', icon: Wrench, path: '/portal/maintenance/new', color: 'bg-yellow-500' },
    { label: 'Contact', icon: MessageSquare, path: '/portal/messages', color: 'bg-blue-500' },
  ],
  user: [
    { label: 'Search Properties', icon: Home, path: '/search', color: 'bg-blue-500' },
    { label: 'Favorites Lists', icon: Building2, path: '/portal/favorites-lists', color: 'bg-red-500' },
    { label: 'Set Alerts', icon: Bell, path: '/portal/alerts', color: 'bg-green-500' },
    { label: 'Property Profiles', icon: Settings, path: '/portal/property-profiles', color: 'bg-purple-500' },
  ],
  maintenance_staff: [
    { label: 'My Jobs', icon: Wrench, path: '/portal/my-jobs', color: 'bg-blue-500' },
    { label: 'Schedule', icon: Calendar, path: '/crm/calendar', color: 'bg-green-500' },
  ]
};

export default function Portal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Redirect admin and agent users directly to CRM dashboard
      if (parsedUser.role === 'admin' || parsedUser.role === 'agent') {
        setLocation('/crm');
        return;
      }
    } else {
      // Redirect to login if not authenticated
      setLocation('/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.'
    });
    setLocation('/');
  };

  if (!user) return null;

  const userRole = user.role || 'tenant';
  const menuItems = menuConfig[userRole as keyof typeof menuConfig] || menuConfig.tenant;
  const quickActions = quickActionsConfig[userRole as keyof typeof quickActionsConfig] || quickActionsConfig.tenant;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'agent': return 'bg-blue-100 text-blue-800';
      case 'landlord': return 'bg-purple-100 text-purple-800';
      case 'tenant': return 'bg-green-100 text-green-800';
      case 'maintenance_staff': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'agent': return 'Agent';
      case 'landlord': return 'Landlord';
      case 'tenant': return 'Tenant';
      case 'maintenance_staff': return 'Maintenance';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-[#791E75] mr-3" />
              <div>
                <h1 className="text-xl font-semibold">John Barclay</h1>
                <p className="text-xs text-gray-500">Property Portal</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.fullName || user?.email}</p>
                  <Badge className={getRoleBadgeColor(userRole)}>
                    {getRoleLabel(userRole)}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-gray-600 mt-1">
            {userRole === 'admin' && 'Manage your entire property portfolio from here.'}
            {userRole === 'agent' && 'View your properties, appointments, and messages.'}
            {userRole === 'landlord' && 'Track your properties, tenants, and income.'}
            {userRole === 'tenant' && 'Manage your tenancy, payments, and maintenance requests.'}
            {userRole === 'maintenance_staff' && 'View and manage your assigned work orders.'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <Card
                  key={index}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(action.path)}
                >
                  <CardContent className="p-4 flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Menu Categories */}
        <div className="space-y-6">
          {menuItems.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h3 className="text-lg font-semibold mb-3">{category.category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  return (
                    <Card
                      key={itemIndex}
                      className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                      onClick={() => setLocation(item.path)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <IconComponent className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium">{item.label}</p>
                              <p className="text-sm text-gray-500">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
