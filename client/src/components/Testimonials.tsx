import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface CMSTestimonial {
  id: number;
  content: string;
  author: string;
  location: string;
  rating: number;
}

const hardcodedTestimonials = [
  {
    id: 1,
    content: "I needed to sell my house quickly due to a job relocation. QuickSell Properties made me a fair offer and completed in just 10 days. The whole process was seamless and stress-free.",
    author: "Sarah J.",
    location: "Manchester",
    rating: 5
  },
  {
    id: 2,
    content: "After trying to sell through an estate agent for months with no success, I contacted QuickSell. They offered a fair price for my property which needed some repairs, and handled everything professionally.",
    author: "John T.",
    location: "Birmingham",
    rating: 4.5
  },
  {
    id: 3,
    content: "Inherited a property that needed a lot of work and didn't want the hassle of renovating it. QuickSell gave me a no-obligation offer within 24 hours and the money was in my account within 3 weeks.",
    author: "Emma L.",
    location: "London",
    rating: 5
  }
];

const Testimonials = () => {
  // Fetch testimonials from CMS, fallback to hardcoded
  const { data: cmsTestimonials } = useQuery<CMSTestimonial[]>({
    queryKey: ['/api/public/testimonials'],
    queryFn: async () => {
      const res = await fetch('/api/public/testimonials');
      if (!res.ok) return null;
      const data = await res.json();
      return data.length > 0 ? data : null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const testimonials = cmsTestimonials || hardcodedTestimonials;

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-primary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What Our Customers Say</h2>
          <p className="text-lg text-neutral-200 max-w-3xl mx-auto">
            Thousands of homeowners have sold their properties with us. Here's what they have to say about their experience.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white p-6 rounded-xl">
              <div className="flex text-accent mb-4">
                {[...Array(Math.floor(testimonial.rating))].map((_, i) => (
                  <Star key={i} className="fill-current" />
                ))}
                {testimonial.rating % 1 > 0 && (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-5 h-5"
                  >
                    <path d="M12 17.75l-6.172 3.245 1.179-6.873-5-4.867 6.9-1 3.086-6.253 3.086 6.253 6.9 1-5 4.867 1.179 6.873z" />
                    <mask id="half-star">
                      <rect x="0" y="0" width="12" height="24" fill="white" />
                    </mask>
                    <path d="M12 17.75l-6.172 3.245 1.179-6.873-5-4.867 6.9-1 3.086-6.253 3.086 6.253 6.9 1-5 4.867 1.179 6.873z" fill="transparent" mask="url(#half-star)" />
                  </svg>
                )}
              </div>
              <p className="mb-4 text-neutral-700">{testimonial.content}</p>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center mr-3">
                  <svg className="h-6 w-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold">{testimonial.author}</p>
                  <p className="text-sm text-neutral-500">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-10 text-center">
          <a href="#testimonials" className="text-white underline hover:text-accent transition">
            View More Reviews
          </a>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
