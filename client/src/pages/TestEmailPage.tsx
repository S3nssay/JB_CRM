import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const TestEmailPage = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<null | { 
    success: boolean; 
    message: string; 
    error?: string;
    directEmailWorked?: boolean;
    templateEmailWorked?: boolean;
    debugInfo?: any;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.smtpConfig) {
        setSmtpConfig(data.smtpConfig);
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to send request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="container mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#0E6BFF]">Test Email Functionality</CardTitle>
            <CardDescription>
              Use this form to test if the email system is working correctly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    We'll send a test property valuation email to this address
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Test Email'
                  )}
                </Button>
              </div>
            </form>

            {result && (
              <Alert 
                className={`mt-4 ${result.success ? 'bg-[#791E75] text-white 50 text-[#791E75]800 border-[#791E75]200' : 'bg-red-50 text-red-800 border-red-200'}`}
              >
                <AlertTitle>
                  {result.success ? 'Success!' : 'Failed!'}
                </AlertTitle>
                <AlertDescription className="mt-2">
                  {result.message}
                  {result.error && (
                    <div className="mt-2 text-sm">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex-col items-start">
            {result && (
              <>
                {result.directEmailWorked !== undefined && (
                  <div className="w-full mb-4 text-sm">
                    <h3 className="font-semibold mb-1">Delivery Status:</h3>
                    <div className="space-y-1">
                      <div className={`flex items-center ${result.directEmailWorked ? 'text-[#791E75]600' : 'text-red-600'}`}>
                        <span className="w-5 h-5 mr-2 inline-flex items-center justify-center rounded-full bg-opacity-20 flex-shrink-0">
                          {result.directEmailWorked ? '✓' : '✗'}
                        </span>
                        <span>Simple Test Email: {result.directEmailWorked ? 'Sent' : 'Failed'}</span>
                      </div>
                      
                      <div className={`flex items-center ${result.templateEmailWorked ? 'text-[#791E75]600' : 'text-red-600'}`}>
                        <span className="w-5 h-5 mr-2 inline-flex items-center justify-center rounded-full bg-opacity-20 flex-shrink-0">
                          {result.templateEmailWorked ? '✓' : '✗'}
                        </span>
                        <span>Template Email: {result.templateEmailWorked ? 'Sent' : 'Failed'}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-[#F8B324]700 text-sm">
                      Note: Even if emails are reported as sent, they might be delayed or filtered by your email provider.
                      Check your spam/junk folders.
                    </div>
                  </div>
                )}
              
                {smtpConfig && (
                  <div className="w-full mt-4 text-xs text-slate-500">
                    <h3 className="font-semibold mb-1">SMTP Configuration:</h3>
                    <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(smtpConfig, null, 2)}
                    </pre>
                  </div>
                )}
                
                {result.debugInfo && (
                  <div className="w-full mt-4 text-xs text-slate-500">
                    <h3 className="font-semibold mb-1">Diagnostic Information:</h3>
                    <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(result.debugInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default TestEmailPage;