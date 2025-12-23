import { Link } from 'wouter';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-bold mb-4">CashPropertyBuyers.uk</h3>
            <p className="text-neutral-300 mb-4">Fast, fair, and transparent property buying service across the UK.</p>
            <p className="text-neutral-300 mb-2">22 Bank Street,<br/>Castleford WF10 1JD</p>
            <p className="text-neutral-300 mb-4">Tel: 01977 285 111</p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-accent transition">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-white hover:text-accent transition">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-white hover:text-accent transition">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-white hover:text-accent transition">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-neutral-300 hover:text-white transition">Home</Link></li>
              <li><a href="#how-it-works" className="text-neutral-300 hover:text-white transition">How It Works</a></li>
              <li><a href="#benefits" className="text-neutral-300 hover:text-white transition">Benefits</a></li>
              <li><a href="#testimonials" className="text-neutral-300 hover:text-white transition">Testimonials</a></li>
              <li><a href="#faq" className="text-neutral-300 hover:text-white transition">FAQ</a></li>
              <li><a href="#contact" className="text-neutral-300 hover:text-white transition">Call Us</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Areas We Cover</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-neutral-300 hover:text-white transition">London</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Manchester</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Birmingham</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Leeds</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Glasgow</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">All UK Areas</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Legal Information</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Terms & Conditions</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Cookie Policy</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Complaints Procedure</a></li>
              <li><a href="#" className="text-neutral-300 hover:text-white transition">Company Details</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-neutral-700 pt-6 text-sm text-neutral-400 text-center">
          <p>© {new Date().getFullYear()} CashPropertyBuyers.uk Ltd. All rights reserved. Registered in England & Wales: 12345678.</p>
          <p className="mt-2">CashPropertyBuyers.uk is a cash house buying company and is not associated with the government.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
