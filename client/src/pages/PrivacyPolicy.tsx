import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Shield } from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";
import { gsap } from 'gsap';

export default function PrivacyPolicy() {
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
              <Shield className="h-12 w-12 md:h-16 md:w-16" />
              PRIVACY POLICY
            </h1>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section ref={contentRef} className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200 shadow-sm">

            <div className="prose prose-lg max-w-none">

              <p className="text-gray-700 mb-6 text-lg">
                This is the privacy notice of John Barclay Estate & Management. In this document, "we" or "us" refers to John Barclay Estate & Management.
              </p>

              <p className="text-gray-700 mb-6">
                Our registered office is at Unit 2.03 Grand Union, 332 Ladbroke Grove, London, W10 5AD
              </p>

              <p className="text-gray-700 mb-6">
                This is a notice to tell you our policy about all information that we record about you. It covers both information that could identify you and information that could not.
              </p>

              <p className="text-gray-700 mb-6">
                We are extremely concerned to protect your privacy and confidentiality. We understand that all users of our web site are quite rightly concerned to know that their data will not be used for any purpose unintended by them, and will not accidentally fall into the hands of a third party. Our policy is both specific and strict. It complies with UK law. If you think our policy falls short of your expectations or that we are failing to abide by our policy, do please tell us.
              </p>

              <p className="text-gray-700 mb-6">
                We regret that if there are one or more points below with which you are not happy, your only recourse is to leave our web site immediately.
              </p>

              <p className="text-gray-700 mb-8">
                Except as set out below, we do not share, or sell, or disclose to a third party, any personally identifiable information collected at this site.
              </p>

              <p className="text-gray-700 mb-8 font-semibold">
                Here is a list of the information we collect from you, either through our web site or because you give it to us in some other way, and why it is necessary to collect it:
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">1. Basic identification and contact information</h2>
              <p className="text-gray-700 mb-2">This information is used:</p>
              <ul className="list-disc pl-6 mb-6 text-gray-700">
                <li>1.1. To provide you with the services which you request;</li>
                <li>1.2. for verifying your identity for security purposes;</li>
                <li>1.3. for marketing our services and products;</li>
                <li>1.4. Information which does not identify any individual may be used in a general way by us or third parties, to provide class information, for example relating to demographics or usage of a particular page or service.</li>
              </ul>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">2. Market place information</h2>
              <p className="text-gray-700 mb-6">
                When we obtain information from you specifically to enable you to use or buy a service offered on our web site by some other person, we assume that in giving us your information, you are also giving us permission to pass it to the relevant person.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">3. Your domain name and e-mail address</h2>
              <p className="text-gray-700 mb-4">
                Your domain name and e-mail address are recognised by our servers and the pages that you visit are recorded. We shall not under any circumstances divulge your e-mail address to any person who is not an employee or contractor of ours and who does not need to know, either generally or specifically.
              </p>
              <p className="text-gray-700 mb-2">This information is used:</p>
              <ul className="list-disc pl-6 mb-6 text-gray-700">
                <li>3.1. To correspond with you or deal with you as you expect.</li>
                <li>3.2. in a collective way not referable to any particular individual, for the purpose of quality control and improvement of our site;</li>
                <li>3.3. To send you news about the services to which you have signed up;</li>
                <li>3.4. To tell you about other of our services or services of sister web sites.</li>
              </ul>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">4. Information you post on our website</h2>
              <p className="text-gray-700 mb-6">
                Information you send to us by posting to a forum or blog is stored on our servers. We do not specifically use of that information except to allow it to be read, but you will see in our terms and conditions that we reserve a right to use it in any way we decide.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">5. Website usage information</h2>
              <p className="text-gray-700 mb-6">
                We may use software embedded in our website (such as JavaScript) to collect information about which pages you view and how you reach them, what you do when you visit a page, the length of time you remain on the page, and how we perform in providing content to you.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">6. Financial information relating only to your credit cards</h2>
              <p className="text-gray-700 mb-6">
                This information is never taken by us either through our website or otherwise. At the point of payment, you are transferred to a secure page on the website of WorldPay/Sage Pay/PayPal/MoneyBookers or some other reputable payment service provider. That page may be dressed in our "livery", but it is not controlled by us. Our staff and contractors never have access to it.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">7. Note on padlock symbols and other trust marks</h2>
              <p className="text-gray-700 mb-6">
                Many companies offer certification and an icon or other small graphic to prove to site visitors that the site is safe. Some certify to a high level of safety. We do not handle information about your credit card so do not subscribe to any such service. However, we suggest you assess this notice to judge that we do take your privacy seriously.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">8. Financial information about your direct debit or your credit cards</h2>
              <p className="text-gray-700 mb-6">
                When you have agreed to set up a direct debit arrangement, the information you have given to us is passed to our own bank for processing according to our instructions. We do keep a copy. We are registered under the direct debit guarantee scheme. This provides for the customer's bank to refund disputed payments without question, pending further investigation. Direct debits can only be set up for payments to beneficiaries that are approved "originators" of direct debits. In order to be approved, these beneficiaries are subjected to careful vetting procedures. Once approved, they are required to give indemnity guarantees through their banks.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">9. Credit reference</h2>
              <p className="text-gray-700 mb-6">
                To assist in combatting fraud, we share information with credit reference agencies so far as it relates to clients or customers who instruct their credit card issuer to cancel payment to us without having first provided an acceptable reason to us and given us the opportunity to refund their money.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">10. Business and personal information</h2>
              <p className="text-gray-700 mb-6">
                This includes all information given to us in the course of your business and ours, such as information you give us in your capacity as our client. We undertake to preserve the confidentiality of the information and of the terms of our relationship. It is not used for any other purpose. We expect you to reciprocate this policy. We keep information which forms part of our business record for a minimum of six years. That is because we may need it in some way to support a claim or defence in court. That is also the period within which our tax collecting authorities may demand to know it.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">11. Third party advertising</h2>
              <p className="text-gray-700 mb-6">
                Third parties may advertise on our web site. In doing so, those parties, their agents or other companies working for them may use technology that automatically collects your IP address when they send an advertisement that appears on our site to your browser. They may also use other technology such as cookies or JavaScript to personalise the content of, and to measure the performance of their adverts. We do not have control over these technologies or the data that these parties obtain. Accordingly, this privacy notice does not cover the information practices of these third parties.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">12. Cookies</h2>
              <p className="text-gray-700 mb-4">
                Cookies are small text files that are placed on your computer's hard drive through your web browser when you visit any web site. They are widely used to make web sites work, or work more efficiently, as well as to provide information to the owners of the site.
              </p>
              <p className="text-gray-700 mb-4">
                Like all other users of cookies, we may request the return of information from your computer when your browser requests a web page from our server. Cookies enable our web server to identify you to us, and to track your actions and the pages you visit while you use our website. The cookies we use may last for a single visit to our site (they are deleted from your computer when you close your browser), or may remain on your computer until you delete them or until a defined period of time has passed.
              </p>
              <p className="text-gray-700 mb-4">
                Although your browser software enables you to disable cookies, we recommend that you allow the use of cookies in order to take advantage of the features of our website that rely on their use.
              </p>
              <p className="text-gray-700 mb-2">If you prevent their use, you will not be able to use all the functionality of our website. Here are the ways we may use cookies:</p>
              <ul className="list-disc pl-6 mb-6 text-gray-700">
                <li>12.1. To record whether you have accepted the use of cookies on our web site. This is solely to comply with the law. If you have chosen not to accept cookies, we will not use cookies for your visit, but unfortunately, our site will not work well for you.</li>
                <li>12.2. To allow essential parts of our web site to operate for you.</li>
                <li>12.3. To operate our content management system.</li>
                <li>12.4. To operate the online notification form - the form that you use to contact us for any reason. This cookie is set on your arrival at our web site and deleted when you close your browser.</li>
                <li>12.5. To enhance security on our contact form. It is set for use only through the contact form. This cookie is deleted when you close your browser.</li>
                <li>12.6. To collect information about how visitors use our site. We use the information to improve your experience of our site and enable us to increase sales. This cookie collects information in an anonymous form, including the number of visitors to the site, where visitors have come to the site from, and the pages they visited.</li>
                <li>12.7. To record that a user has viewed a webcast. It collects information in an anonymous form. This cookie expires when you close your browser.</li>
                <li>12.8. To record your activity during a web cast. For example, as to whether you have asked a question or provided an opinion by ticking a box. This information is retained so that we can serve your information to you when you return to the site. This cookie will record an anonymous ID for each user, but it will not use the information for any other purpose. This cookie will last for a period of time after which it will delete automatically.</li>
                <li>12.9. To store your personal information so that you do not have to provide it afresh when you visit the site next time. This cookie will last for a period of time after which it will delete automatically.</li>
                <li>12.10. To enable you to watch videos we have placed on YouTube. YouTube will not store personally identifiable cookie information when you use YouTube's privacy-enhanced mode.</li>
              </ul>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">13. Sending a message to our support system</h2>
              <p className="text-gray-700 mb-6">
                When you send a message, we collect the data you have given to us in that message in order to obtain confirmation that you are entitled to receive the information and to provide to you the information you need. We record your request and our reply in order to increase the efficiency of our business / organisation. We may keep personally identifiable information associated with your message, such as your name or email address.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">14. Complaining</h2>
              <p className="text-gray-700 mb-6">
                When we receive a complaint, we record all the information you have given to us. We use that information to resolve your complaint. If your complaint reasonably requires us to contact some other person, we may decide to give to that other person some of the information contained in your complaint. We do this as infrequently as possible, but it is a matter for our sole discretion as to whether we do give information, and, if we do, what that information is. We may also compile statistics showing information obtained from this source to assess the level of service we provide, but not in a way that could identify you or any other person.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">15. Third party content</h2>
              <p className="text-gray-700 mb-6">
                Our web site is a publishing medium in that anyone may register and then publish information about himself or some other person. We do not moderate or control what is posted. If you complain about any of the content on our web site, we shall investigate your complaint. If we feel it may be justified, we shall remove it while we investigate. Free speech is a fundamental right, so we have to make a judgement as to whose right will be obstructed: yours, or that of the person who posted the content which offends you. If we think your complaint is vexatious or without any basis, we shall not correspond with you about it.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">16. Job application and employment</h2>
              <p className="text-gray-700 mb-6">
                If you send us information in connection with a job application, we may keep it for up to three years in case we decide to contact you at a later date. If we employ you, we collect information about you and your work from time to time throughout the period of your employment. This information will be used only for purposes directly relevant to your employment. After your employment has ended, we will keep your file for six years before destroying or deleting it.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">17. Content you provide to us</h2>
              <p className="text-gray-700 mb-6">
                If you provide information to us with a view to it being read, copied, downloaded or used by other people, we accept no responsibility for what that third party may do with it. It is up to you to satisfy yourself about the privacy level of every person who might see your information. If it is available to all the World, you have no control whatsoever as to how it is used.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">18. Disclosure to Government and their agencies</h2>
              <p className="text-gray-700 mb-6">
                We are subject to the law like everyone else. We may be required to give information to legal authorities if they so request or if they have the proper authorisation such as a search warrant or court order.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">19. Review or update personally identifiable information</h2>
              <p className="text-gray-700 mb-6">
                At any time you may review or update the personally identifiable information that we hold about you by contacting us at the address below. To better safeguard your information, we will also take reasonable steps to verify your identity before granting access or making corrections to your information. John Barclay Estate & Management, Unit 2.03 Grand Union, 332 Ladbroke Grove, London, W10 5AD
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">20. Sale of your personal information</h2>
              <p className="text-gray-700 mb-6">
                Except as specified above, we do not rent, sell or otherwise disclose any of your information to any person outside our business.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">21. Compliance with the law</h2>
              <p className="text-gray-700 mb-6">
                This confidentiality policy has been compiled so as to comply with the law of every jurisdiction in which we aim to do business. If you think it fails to satisfy the law of your country, we should like to hear from you, but ultimately it is your choice as to whether you wish to use our website.
              </p>

              <h2 className="text-2xl font-bold text-[#5d1759] mb-4">22. Removal of your information</h2>
              <p className="text-gray-700 mb-8">
                If you wish us to remove personally identifiable information from our web site, you may contact us at info@johnbarclay.co.uk. To better safeguard your information, we will also take reasonable steps to verify your identity before granting access or making corrections to your information. If you have any question regarding this privacy policy and notice please contact us through info@johnbarclay.co.uk
              </p>

            </div>

            {/* Back Links */}
            <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4 justify-center">
              <Link href="/terms-and-conditions">
                <Button variant="outline" className="border-[#791E75] text-[#791E75] hover:bg-[#791E75] hover:text-white">
                  Terms & Conditions
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
