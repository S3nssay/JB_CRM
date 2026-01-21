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
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
  const contactRefs = useRef<HTMLDivElement[]>([]);

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
    // Initial state - hide all elements
    gsap.set([titleRef.current, subtitleRef.current, phoneRef.current, emailRef.current, locationRef.current, whatsappRef.current, hoursRef.current], {
      opacity: 0,
      y: 100,
      scale: 0.8
    });

    // Title animation
    gsap.to(titleRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.5,
      ease: "power3.out",
      scrollTrigger: {
        trigger: titleRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    // Subtitle animation
    gsap.to(subtitleRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.2,
      ease: "power3.out",
      delay: 0.3,
      scrollTrigger: {
        trigger: subtitleRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    // Contact items staggered animation
    const contactItems = [phoneRef.current, emailRef.current, locationRef.current];
    gsap.to(contactItems, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1,
      ease: "power3.out",
      stagger: 0.2,
      delay: 0.6,
      scrollTrigger: {
        trigger: phoneRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    // WhatsApp button animation
    gsap.to(whatsappRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.5,
      ease: "elastic.out(1, 0.3)",
      delay: 1.2,
      scrollTrigger: {
        trigger: whatsappRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    // Working hours animation
    gsap.to(hoursRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.2,
      ease: "power3.out",
      delay: 1.5,
      scrollTrigger: {
        trigger: hoursRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse"
      }
    });

    // Removed floating and pulsing animations for a cleaner look

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
    <section id="contact" className="relative min-h-screen py-16 sm:py-24 md:py-32 bg-gradient-to-b from-white to-gray-50 overflow-hidden">

      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating circles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#8B4A9C]/5 animate-pulse"
            style={{
              width: `${50 + Math.random() * 100}px`,
              height: `${50 + Math.random() * 100}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">

        {/* Animated Title */}
        <div className="text-center mb-12 sm:mb-20 md:mb-32">
          <div ref={titleRef} className="mb-4 sm:mb-6 md:mb-8">
            <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-[#8B4A9C]">
              Connect With Us
            </h2>
          </div>
          <div ref={subtitleRef}>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 max-w-4xl mx-auto px-4 md:px-0">
              Experience exceptional service with London's premier estate agents
            </p>
          </div>
        </div>

        {/* Animated Contact Information */}
        <div className="max-w-6xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <div className="grid md:grid-cols-3 gap-8 sm:gap-12 md:gap-16">

            {/* Phone */}
            <div ref={phoneRef} className="text-center">
              <div className="bg-[#8B4A9C] w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 md:mb-8 shadow-2xl">
                <Phone className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mb-2 sm:mb-3 md:mb-4">Call</h3>
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#8B4A9C]">+44 7367 087752</p>
            </div>

            {/* Email */}
            <div ref={emailRef} className="text-center">
              <div className="bg-[#8B4A9C] w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 md:mb-8 shadow-2xl">
                <Mail className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mb-2 sm:mb-3 md:mb-4">Email</h3>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-[#8B4A9C] break-words">lettings@johnbarclay.co.uk</p>
            </div>

            {/* Location */}
            <div ref={locationRef} className="text-center">
              <div className="bg-[#8B4A9C] w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 md:mb-8 shadow-2xl">
                <MapPin className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mb-2 sm:mb-3 md:mb-4">Visit</h3>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-[#8B4A9C]">
                332 Ladbroke Grove<br />London W10 5AD
              </p>
            </div>

          </div>
        </div>

        {/* Animated WhatsApp Button */}
        <div className="text-center mb-12 sm:mb-16 md:mb-20 px-4">
          <div ref={whatsappRef}>
            <a
              href="https://wa.me/442089693322?text=Hi%2C%20I%27d%20like%20to%20inquire%20about%20your%20property%20services."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] hover:bg-[#20b954] text-white font-bold py-3 sm:py-4 md:py-6 px-4 sm:px-6 md:px-10 text-sm sm:text-base md:text-xl rounded-full shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-105 md:hover:scale-110 max-w-full"
            >
              <MessageCircle className="mr-2 sm:mr-3 md:mr-4 h-4 w-4 sm:h-5 sm:w-5 md:h-8 md:w-8 flex-shrink-0" />
              <span className="whitespace-nowrap">Start WhatsApp Chat</span>
              <ArrowRight className="ml-2 sm:ml-3 md:ml-4 h-4 w-4 sm:h-5 sm:w-5 md:h-8 md:w-8 flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* Working Hours - Plain Text */}
        <div className="text-center pb-8 sm:pb-12 md:pb-16">
          <div ref={hoursRef}>
            <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-slate-600">Working Hours</h3>
            <div className="space-y-2 sm:space-y-3 text-sm sm:text-base md:text-lg lg:text-xl text-slate-600">
              <div>Monday - Friday: 9:00 AM - 6:00 PM</div>
              <div>Saturday: 10:00 AM - 4:00 PM</div>
              <div>Sunday: Closed</div>
            </div>
          </div>
        </div>

        {/* Footer with Legal Links */}
        <div className="border-t border-slate-200 pt-8 sm:pt-12">
          <div className="max-w-4xl mx-auto">
            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-6 sm:mb-8">
              <Link href="/terms-and-conditions">
                <span className="inline-flex items-center text-sm sm:text-base text-[#8B4A9C] hover:text-[#6d3a7a] transition-colors cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Terms & Conditions
                </span>
              </Link>
              <Link href="/privacy-policy">
                <span className="inline-flex items-center text-sm sm:text-base text-[#8B4A9C] hover:text-[#6d3a7a] transition-colors cursor-pointer">
                  <Shield className="h-4 w-4 mr-2" />
                  Privacy Policy
                </span>
              </Link>
            </div>

            {/* Copyright */}
            <div className="text-center text-xs sm:text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} John Barclay Estate & Management. All rights reserved.</p>
              <p className="mt-2">Unit 2.03 Grand Union, 332 Ladbroke Grove, London, W10 5AD</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ContactSection;