import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CMSFaqItem {
  id: number;
  question: string;
  answer: string;
}

const hardcodedFaqItems = [
    {
      question: "How quickly can I get an offer on my home?",
      answer: "We provide a free instant online valuation to give you an immediate estimate. For a formal, no-obligation offer, we'll conduct an in-depth phone valuation and deliver a written offer within 24 hours. No waiting, no delays – just a straightforward start to your sale."
    },
    {
      question: "How fast can you complete the purchase?",
      answer: "We can finalise the sale in as little as 7 days, but we work entirely to your timeline. Whether you need to sell urgently or require more flexibility, we adapt to your priorities."
    },
    {
      question: "How are you able to buy so quickly?",
      answer: "Our speed comes from exclusive advantages:\n\nDedicated legal panel: Specialist solicitors with expertise in fast cash purchases.\n\nNo mortgage delays: We use pre-allocated cash funds, avoiding lengthy approvals or chains.\n\nTotal flexibility: Complete on your terms, whether 7 days or 7 weeks."
    },
    {
      question: "When will I receive the funds?",
      answer: "Once contracts are exchanged, funds are guaranteed and will be in your bank account within 7 days (or your chosen timeframe)."
    },
    {
      question: "Are there any fees or hidden costs?",
      answer: "Absolutely none. The offer you receive is the amount you'll get – no commission, no legal fees, no surprises. We cover all costs, including your solicitor's fees."
    },
    {
      question: "Do you buy houses in any condition or location?",
      answer: "Yes! We buy any home, anywhere in the British Isles – from Scotland to the South Coast. Age, condition, or location won't stop us."
    },
    {
      question: "What if I change my mind about selling?",
      answer: "No pressure, no obligation. Walk away at any time, and we'll happily restart the process later if needed."
    },
    {
      question: "How are you better than a high street estate agent?",
      answer: "Guaranteed sale: We're the buyer, not just a middleman.\n\nSpeed: Skip months of viewings, negotiations, and chains.\n\nZero fees: Save thousands vs. agent commissions and legal bills.\n\nStress-free: No decorating, viewings, or price haggling."
    },
    {
      question: "What happens after I accept your offer?",
      answer: "We handle everything:\n\nOur specialist solicitors manage the legal process.\n\nYou simply answer basic questions and sign contracts.\n\nGuaranteed completion once contracts are exchanged."
    },
    {
      question: "Can you help with mortgage arrears or divorce?",
      answer: "Yes. We'll:\n\nNegotiate directly with lenders to halt repossession.\n\nFast-track sales to resolve financial stress or split assets fairly.\n\nPrioritise discretion and urgency in sensitive situations."
    },
    {
      question: "What paperwork do I need to provide?",
      answer: "Almost none. We handle all documentation internally. Just answer a few questions about your property – no endless forms or solicitor back-and-forth."
    },
    {
      question: "Do I need my own solicitor?",
      answer: "We cover all legal fees and provide expert solicitors. You're welcome to use your own, but we'll still pay their costs."
    },
    {
      question: "Is the process confidential?",
      answer: "100% private. We only share necessary details with solicitors and surveyors. No public listings, no nosy neighbours."
    },
    {
      question: "Why choose CashPropertyBuyers.uk over an agent?",
      answer: "Certainty: No chains, no fall-throughs.\n\nSpeed: Sell in days, not months.\n\nCost savings: Keep every penny of our offer.\n\nControl: Set the timeline, skip the hassle."
    }
  ];

const FAQSection = () => {
  // Fetch FAQ items from CMS, fallback to hardcoded
  const { data: cmsFaqItems } = useQuery<CMSFaqItem[]>({
    queryKey: ['/api/public/faq'],
    queryFn: async () => {
      const res = await fetch('/api/public/faq');
      if (!res.ok) return null;
      const data = await res.json();
      return data.length > 0 ? data : null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const faqItems = cmsFaqItems || hardcodedFaqItems;

  return (
    <section id="faq" className="py-16 md:py-24 px-4 bg-white">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-inter text-4xl font-bold text-[#0E6BFF] mb-6">Frequently Asked Questions</h2>
          <p className="font-roboto text-base md:text-lg max-w-3xl mx-auto">
            Everything you need to know about our cash property buying service
          </p>
        </div>
        
        <Accordion type="single" collapsible={true} className="w-full space-y-4">
          {faqItems.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`faq-${index}`}
              className="border border-[#E5E7EB] rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="py-4 px-6 bg-[#F9FAFB] hover:bg-[#F7EF81]/20 text-left font-medium text-[#0E6BFF]">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="px-6 py-4 text-neutral-600 whitespace-pre-line">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        
        <div className="mt-12 bg-white p-6 rounded-xl border border-neutral-200">
          <h3 className="text-xl font-bold text-[#0E6BFF] mb-6 text-center">Client Testimonials</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#F7EF81] p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="text-[#0E6BFF]">
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 text-neutral-600 font-medium">David Thompson, Leeds</div>
              </div>
              <p className="text-[#0E6BFF] italic">"After struggling to sell my house for 8 months with a traditional estate agent, CashPropertyBuyers.uk made me an offer within 24 hours and completed in just 11 days. The price was fair and the process was completely stress-free."</p>
            </div>
            
            <div className="bg-[#F7EF81] p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="text-[#0E6BFF]">
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 text-neutral-600 font-medium">Sarah Williams, Manchester</div>
              </div>
              <p className="text-[#0E6BFF] italic">"I was going through a difficult divorce and needed a quick sale. CashPropertyBuyers.uk handled everything with sensitivity and professionalism. They made a fair offer and completed in 14 days, which allowed me to move on with my life."</p>
            </div>

            <div className="bg-[#F7EF81] p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="text-[#0E6BFF]">
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 text-neutral-600 font-medium">James Cooper, Birmingham</div>
              </div>
              <p className="text-[#0E6BFF] italic">"My property needed extensive repairs which I couldn't afford. Most buyers were put off, but CashPropertyBuyers.uk saw the potential and made a fair offer despite the condition. I was amazed at how simple they made the whole process."</p>
            </div>
            
            <div className="bg-[#F7EF81] p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="text-[#0E6BFF]">
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                  <svg className="h-5 w-5 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 text-neutral-600 font-medium">Emma Richardson, London</div>
              </div>
              <p className="text-[#0E6BFF] italic">"I inherited a property in another city and didn't want the hassle of maintaining it from a distance. CashPropertyBuyers.uk offered me a fair price, handled all the paperwork, and completed within 3 weeks. The funds were in my account exactly when promised."</p>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <h4 className="text-lg font-bold text-[#0E6BFF] mb-2">Ready to Sell?</h4>
            <p className="text-neutral-600 mb-4">Join our satisfied customers and experience a hassle-free property sale on your terms.</p>
            <a 
              href="#valuationForm" 
              className="inline-block bg-[#0E6BFF] text-white px-6 py-3 rounded-md font-medium hover:bg-[#0E6BFF]/90 transition text-center"
            >
              Get Your Free Valuation Online
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;