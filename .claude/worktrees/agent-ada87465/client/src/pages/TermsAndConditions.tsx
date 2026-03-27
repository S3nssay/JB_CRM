import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, FileText } from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";
import { gsap } from 'gsap';

export default function TermsAndConditions() {
  const heroRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(heroRef.current, {
      opacity: 0,
      y: 50
    }, {
      opacity: 1,
      y: 0,
      duration: 1.5,
      ease: "power4.out"
    });

    gsap.fromTo(contentRef.current, {
      opacity: 0,
      y: 30
    }, {
      opacity: 1,
      y: 0,
      duration: 1.2,
      delay: 0.3,
      ease: "power3.out"
    });
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Hero Section */}
      <section ref={heroRef} className="relative py-16 px-6 overflow-hidden" style={{ backgroundColor: '#791E75' }}>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-slate-300/20 to-slate-500/10 rounded-full blur-sm"></div>
          <div className="absolute bottom-20 right-32 w-48 h-48 bg-gradient-to-br from-slate-400/15 to-[#791E75]/5 rounded-3xl rotate-45 blur-sm"></div>
        </div>

        {/* Navigation Buttons */}
        <div className="relative z-10 max-w-6xl mx-auto mb-8">
          <div className="flex justify-between items-center">
            <Button
              onClick={() => window.history.back()}
              className="bg-[#791E75] hover:bg-[#5d1759] text-white px-4 py-2 rounded-xl flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-4 py-2 rounded-xl flex items-center">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="mb-6">
              <img
                src={heroLogo}
                alt="John Barclay Estate & Management"
                className="max-w-md w-full h-auto mx-auto mb-4"
              />
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-none mb-4 text-white flex items-center justify-center gap-4">
              <FileText className="h-12 w-12 md:h-16 md:w-16" />
              TERMS & CONDITIONS
            </h1>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section ref={contentRef} className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200 shadow-sm">

            <div className="prose prose-lg max-w-none">

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">1. This Website</h2>
              <p className="text-gray-700 mb-6">
                John Barclay Estate & Management owns the website located at www.johnbarclay.co.uk (the "Website"). By accessing and using the Website you the user agree to be bound by these terms and conditions (the "Terms") which govern your access to and use of the Website.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">2. Ownership and Use of Content</h2>
              <p className="text-gray-700 mb-4">
                2.1 All text, data, charts, tables, software, video, music, sound, graphics, photographs, illustrations, artwork, names, logos, trademarks, service marks and other material on the Website (the "Content") and all rights in it belongs to John Barclay Estate & Management. You may retrieve and display Content from the Website on a computer screen, print individual pages on paper (but not photocopy them) and store such pages in electronic form on disk (but not on any server or other storage device connected to a network) for your personal use. Content may not be copied, reproduced, republished, downloaded, posted, broadcast or transmitted in any other way.
              </p>
              <p className="text-gray-700 mb-6">
                2.2 You agree not to adapt, alter or create a derivative work from any of the Content on the Website or to use it for any purpose other than for your personal and non-commercial use.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">3. Unlawful Use</h2>
              <p className="text-gray-700 mb-6">
                You agree to use this Website only for lawful purposes and in a manner that does not infringe the rights of or restrict or inhibit the use and enjoyment of the Website by any third party. Such restriction or inhibition includes, but is not limited to, conduct which is defamatory, or which may harass, cause distress or inconvenience to any person and the transmission of obscene or offensive content or the disruption of normal flow of dialogue within the Website.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">4. Intellectual Property Rights</h2>
              <p className="text-gray-700 mb-4">
                4.1 All copyright, trademarks, database rights and other intellectual property rights that may exist in this Website and the Content shall remain at all times the property of John Barclay Estate & Management.
              </p>
              <p className="text-gray-700 mb-6">
                4.2 The trademarks, service marks and logos used and displayed on this Website ("Trade Marks") are registered or unregistered trademarks of John Barclay Estate & Management. Nothing on this Website should be construed as granting, by implication or otherwise, any licence or right to use any Trade Mark without written permission from John Barclay Estate & Management. The name of John Barclay Estate & Management may not be used in any way, including in advertising or publicity pertaining to distribution of Content without the prior written permission of John Barclay Estate & Management.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">5. Liability</h2>
              <p className="text-gray-700 mb-4">
                5.1 The Website and Content is provided "AS IS" and on an "AS AVAILABLE" basis and John Barclay Estate & Management does not guarantee the accuracy, timeliness, completeness, performance or fitness for a particular purpose of the Website or any Content. All implied warranties, including but not limited to the implied warranties of satisfactory quality, fitness for a particular purpose, non-infringement, compatibility, security and accuracy are excluded from these Terms to the extent that they may be excluded as a matter of law.
              </p>
              <p className="text-gray-700 mb-4">
                5.2 In no event will John Barclay Estate & Management be liable for any loss including, without limitation, indirect or consequential loss, or any damages arising from loss of use, data or profits, whether in contract, tort or otherwise, arising out of or in connection with the use of this Website.
              </p>
              <p className="text-gray-700 mb-4">
                5.3 John Barclay Estate & Management has tried to ensure that all the Content provided on the Website is correct at the time of publication. The Content is provided on an information basis only and should not be relied upon. No responsibility is accepted by or on behalf of John Barclay Estate & Management for any errors, omissions, or misleading Content on the Website or on any websites to which the Website connects.
              </p>
              <p className="text-gray-700 mb-6">
                5.4 John Barclay Estate & Management does not warrant that the Website or Content will be uninterrupted or error free, that any defects will be corrected, or that this Website or the server that makes it available are free of viruses or bugs.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">6. Privacy</h2>
              <p className="text-gray-700 mb-6">
                You must read and accept the John Barclay Estate & Management Privacy Policy which details what type of personal information John Barclay Estate & Management may collect from you when you visit the Website and how John Barclay Estate & Management may store and use the information in accordance with the Data Protection Act 1998 and the Privacy and Electronic Communications Act 2003.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">7. Changes to the Terms</h2>
              <p className="text-gray-700 mb-6">
                John Barclay Estate & Management reserve the right, at its discretion, to make changes to any parts of the Website or these Terms. When these Terms are amended, John Barclay Estate & Management will publish details of the amendments on the Website. Your continued use of the Website is taken as your agreement to be bound by these Terms as amended.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">8. Jurisdiction</h2>
              <p className="text-gray-700 mb-6">
                These Terms shall be governed by and construed in accordance with English Law and subject to the exclusive jurisdiction of the English Courts.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">9. Severability</h2>
              <p className="text-gray-700 mb-6">
                If these Terms or any part of them should be determined to be illegal, invalid or otherwise unenforceable under the laws of any state or country in which these Terms are intended to be effective, then to the extent that they are so illegal, invalid or unenforceable, they shall in that state or country be treated as severed and deleted from these Terms and the remaining Terms shall survive and remain in full force and effect and continue to be binding and enforceable in that state or country.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">10. Conflict</h2>
              <p className="text-gray-700 mb-6">
                If there is any conflict between these Terms and any other written agreement between you and John Barclay Estate & Management then the latter shall prevail.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">11. Events beyond our control</h2>
              <p className="text-gray-700 mb-6">
                John Barclay Estate & Management will not be responsible for any breach of these Terms caused by circumstances beyond its reasonable control.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">12. Links</h2>
              <p className="text-gray-700 mb-6">
                John Barclay Estate & Management is not responsible for the availability or content of any third party websites or material you access through this Website.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">13. File Download</h2>
              <p className="text-gray-700 mb-6">
                Certain files of Content are available for download from the Website. These files of Content are subject to these Terms.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">14. Contact</h2>
              <p className="text-gray-700 mb-8">
                If you wish to contact John Barclay Estate & Management regarding the Website, these Terms or the Privacy Policy please contact us by post or in person at John Barclay Estate & Management, Unit 2.03 Grand Union, 332 Ladbroke Grove, London, W10 5AD, by telephone on +44 7367 087752 or by email at info@johnbarclay.co.uk
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">Where We Operate</h2>
              <p className="text-gray-700">
                Bayswater W2 | Harlesden NW10 | Kensal Green NW10 | Kensal Rise NW10 | Kilburn NW6 | Ladbroke Grove W10 | Maida Vale W9 | Maida Hill W9 | North Kensington W10 | Queens Park NW6 | St Johns Wood NW8 | Westbourne Park W10, W11 | Willesden NW10, NW2
              </p>

            </div>

            {/* Back Links */}
            <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4 justify-center">
              <Link href="/privacy-policy">
                <Button variant="outline" className="border-[#791E75] text-[#791E75] hover:bg-[#791E75] hover:text-white">
                  Privacy Policy
                </Button>
              </Link>
              <Link href="/">
                <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white">
                  Return Home
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
