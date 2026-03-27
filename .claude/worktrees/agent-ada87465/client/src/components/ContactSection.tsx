import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { contactFormSchema, type ContactFormData } from '@shared/schema';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MapPin, MessageCircle, ArrowRight, FileText, Shield } from 'lucide-react';
import { Link } from 'wouter';
import gsap from 'gsap';

const ContactSection = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Animation refs
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const whatsappRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      message: ''
    }
  });

  useEffect(() => {
    // Simple fade-in animation on mount (no ScrollTrigger needed for fixed section)
    const elements = [titleRef.current, subtitleRef.current, phoneRef.current, emailRef.current, locationRef.current, whatsappRef.current, hoursRef.current].filter(Boolean);

    // Set initial state
    gsap.set(elements, { opacity: 0, y: 30 });

    // Animate to visible
    gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.1
    });
  }, []);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      await apiRequest('/api/contacts', 'POST', data);

      toast({
        title: "Message sent!",
        description: "Thank you for contacting us. We'll be in touch shortly.",
      });

      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem sending your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="relative min-h-screen py-8 sm:py-12 md:py-16 bg-gradient-to-b from-white to-gray-50 overflow-hidden">

      <div className="container mx-auto px-4 sm:px-6 relative z-10">

        {/* Animated Title */}
        <div className="text-center mb-6 sm:mb-8 md:mb-12">
          <div ref={titleRef} className="mb-2 sm:mb-3 md:mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#8B4A9C]">
              Connect With Us
            </h2>
          </div>
          <div ref={subtitleRef}>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-3xl mx-auto px-4 md:px-0">
              Experience exceptional service with London's premier estate agents
            </p>
          </div>
        </div>

        {/* Animated Contact Information */}
        <div className="max-w-5xl mx-auto mb-6 sm:mb-8 md:mb-10">
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">

            {/* Phone */}
            <div ref={phoneRef} className="text-center">
              <div className="bg-[#8B4A9C] w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 shadow-xl">
                <Phone className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 mb-1 sm:mb-2">Call</h3>
              <p className="text-base sm:text-lg md:text-xl font-bold text-[#8B4A9C]">+44 7367 087752</p>
            </div>

            {/* Email */}
            <div ref={emailRef} className="text-center">
              <div className="bg-[#8B4A9C] w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 shadow-xl">
                <Mail className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 mb-1 sm:mb-2">Email</h3>
              <p className="text-sm sm:text-base md:text-lg font-semibold text-[#8B4A9C] break-words">enquiries@johnbarclay.co.uk</p>
            </div>

            {/* Location */}
            <div ref={locationRef} className="text-center">
              <div className="bg-[#8B4A9C] w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4 shadow-xl">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 mb-1 sm:mb-2">Visit</h3>
              <p className="text-sm sm:text-base md:text-lg font-semibold text-[#8B4A9C]">
                332 Ladbroke Grove<br />London W10 5AD
              </p>
            </div>

          </div>
        </div>

        {/* Animated WhatsApp Button */}
        <div className="text-center mb-6 sm:mb-8 md:mb-10 px-4">
          <div ref={whatsappRef}>
            <a
              href="https://wa.me/447367087752?text=Hi%2C%20I%27d%20like%20to%20inquire%20about%20your%20property%20services."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] hover:bg-[#20b954] text-white font-bold py-2 sm:py-3 md:py-4 px-4 sm:px-6 md:px-8 text-sm sm:text-base md:text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105 max-w-full"
            >
              <MessageCircle className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex-shrink-0" />
              <span className="whitespace-nowrap">Start WhatsApp Chat</span>
              <ArrowRight className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* Working Hours - Plain Text */}
        <div className="text-center pb-6 sm:pb-8 md:pb-10">
          <div ref={hoursRef}>
            <h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-3 md:mb-4 text-slate-600">Working Hours</h3>
            <div className="space-y-1 sm:space-y-2 text-sm sm:text-base md:text-lg text-slate-600">
              <div>Monday - Friday: 9:00 AM - 6:00 PM</div>
              <div>Saturday: 10:00 AM - 4:00 PM</div>
              <div>Sunday: Closed</div>
            </div>
          </div>
        </div>

        {/* Footer with Legal Links */}
        <div className="border-t border-slate-200 pt-6 sm:pt-8">
          <div className="max-w-4xl mx-auto">
            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-4 sm:mb-6">
              <Link href="/terms-and-conditions">
                <span className="inline-flex items-center text-xs sm:text-sm text-[#8B4A9C] hover:text-[#6d3a7a] transition-colors cursor-pointer">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Terms & Conditions
                </span>
              </Link>
              <Link href="/privacy-policy">
                <span className="inline-flex items-center text-xs sm:text-sm text-[#8B4A9C] hover:text-[#6d3a7a] transition-colors cursor-pointer">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Privacy Policy
                </span>
              </Link>
            </div>

            {/* Copyright */}
            <div className="text-center text-xs text-slate-500">
              <p>&copy; {new Date().getFullYear()} John Barclay Estate & Management. All rights reserved.</p>
              <p className="mt-1">Unit 2.03 Grand Union, 332 Ladbroke Grove, London, W10 5AD</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ContactSection;