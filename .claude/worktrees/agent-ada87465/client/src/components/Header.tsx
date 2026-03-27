import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Menu, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import johnBarclayLogo from '@/assets/john-barclay-logo.png';

interface NavigationHandlers {
  howItWorks: () => void;
  benefits: () => void;
  testimonials: () => void;
  faq: () => void;
}

interface HeaderProps {
  navigationHandlers?: NavigationHandlers;
}

const Header = ({ navigationHandlers }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const navItems = [
    { key: "howItWorks", label: "How It Works" },
    { key: "benefits", label: "Benefits" },
    { key: "testimonials", label: "Testimonials" },
    { key: "faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-[#8B4A9C] shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex flex-col items-center">
              <img
                src={johnBarclayLogo}
                alt="John Barclay Estate & Management"
                className="h-16 w-auto max-w-[200px] object-contain"
              />
              <span className="text-white font-bold text-sm mt-1">SALES</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <button 
                key={item.key}
                onClick={() => navigationHandlers?.[item.key as keyof NavigationHandlers]?.()} 
                className="font-medium text-white hover:text-[#F7EF81] transition cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <a 
              href="https://wa.me/447123456789?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20your%20services" 
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-md font-medium hover:bg-[#128C7E] transition"
            >
              <MessageCircle className="w-4 h-4" />
              Contact Us
            </a>
            <Button
              variant="ghost"
              className="md:hidden text-white hover:text-[#F7EF81]" 
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <div className={cn("px-4 py-3 bg-[#8B4A9C] border-t md:hidden", 
        mobileMenuOpen ? "block" : "hidden")}>
        <nav className="flex flex-col space-y-3">
          {navItems.map((item) => (
            <button 
              key={item.key}
              onClick={() => {
                navigationHandlers?.[item.key as keyof NavigationHandlers]?.();
                setMobileMenuOpen(false);
              }}
              className="font-medium text-white hover:text-[#F7EF81] transition text-left"
            >
              {item.label}
            </button>
          ))}
          <a 
            href="https://wa.me/447123456789?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20your%20services" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-md font-medium hover:bg-[#128C7E] transition text-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            <MessageCircle className="w-4 h-4" />
            Contact Us
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
