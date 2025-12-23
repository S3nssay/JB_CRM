import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessagesSquare, ArrowLeft } from 'lucide-react';

const TestDashboardPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center">
          <Link href="/">
            <Button variant="outline" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-[#0E6BFF]">Testing Dashboard</h1>
        </div>
        
        <p className="mb-8 text-[#791E75]">
          This dashboard provides tools to test various system functionalities. Use these tools to verify that 
          notifications are working correctly.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl text-[#0E6BFF]">
                <Mail className="h-5 w-5 mr-2" />
                Email Testing
              </CardTitle>
              <CardDescription>
                Test email functionality by sending a test email to any address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#791E75]">
                This will send a test property valuation email with dummy data to verify that the email system is working correctly.
                You can check both customer emails and internal notification emails.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/test-email">
                <Button>
                  Test Email System
                </Button>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl text-[#0E6BFF]">
                <MessagesSquare className="h-5 w-5 mr-2" />
                SMS Testing
              </CardTitle>
              <CardDescription>
                Test SMS functionality by sending a test message to any phone number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#791E75]">
                This will send a test SMS with property valuation details to verify that the messaging system is 
                working correctly. For trial accounts, phone numbers need to be verified first.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/test-sms">
                <Button>
                  Test SMS System
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mt-8 p-4 bg-[#F8B324] text-black 50 border border-[#F8B324]200 rounded-lg">
          <h3 className="text-[#F8B324]800 text-lg font-semibold mb-2">Important Notes</h3>
          <ul className="text-sm text-[#F8B324]800 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>For email tests to work, ensure the SMTP settings are correctly configured in the environment variables.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>For SMS tests to work, ensure the Twilio credentials are correctly set up and the recipient number is verified (for trial accounts).</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>These tests will generate real emails and SMS messages with associated costs if using paid services.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestDashboardPage;