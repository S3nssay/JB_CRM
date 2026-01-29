import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TeamMember {
  id: number;
  name: string;
  jobTitle: string;
  bio: string;
  photo: string;
  department: string;
  displayOrder: number;
}

export default function TeamPage() {
  // Fetch team members from public API
  const { data: team, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/public/team'],
    queryFn: async () => {
      const res = await fetch('/api/public/team');
      if (!res.ok) return [];
      return res.json();
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="bg-[#0E6BFF] text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Meet Our Team
            </h1>
            <p className="text-lg md:text-xl text-blue-100">
              Our experienced team of property professionals is dedicated to providing
              exceptional service and expertise to help you achieve your property goals.
            </p>
          </div>
        </div>
      </section>

      {/* Team Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E6BFF] mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading team members...</p>
            </div>
          ) : !team || team.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Our team information is being updated. Please check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {team.map((member) => (
                <TeamMemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#F7EF81] py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-[#0E6BFF] mb-4">
            Ready to Work With Us?
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
            Whether you're buying, selling, renting, or need property management services,
            our team is here to help you every step of the way.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/valuation">
              <Button size="lg" className="bg-[#0E6BFF] hover:bg-[#0E6BFF]/90">
                Get a Free Valuation
              </Button>
            </Link>
            <Link href="/#contact">
              <Button size="lg" variant="outline" className="border-[#0E6BFF] text-[#0E6BFF]">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer navigation */}
      <section className="py-8 bg-white border-t">
        <div className="container mx-auto px-4">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const initials = member.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Photo or Placeholder */}
      <div className="aspect-[4/3] bg-gradient-to-br from-[#0E6BFF] to-[#0E6BFF]/70 relative">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl font-bold text-white/30">{initials}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          {member.name}
        </h3>
        <p className="text-[#0E6BFF] font-medium mb-4">
          {member.jobTitle}
        </p>
        {member.bio && (
          <p className="text-gray-600 text-sm leading-relaxed">
            {member.bio}
          </p>
        )}
        {member.department && (
          <div className="mt-4 pt-4 border-t">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full capitalize">
              {member.department}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
