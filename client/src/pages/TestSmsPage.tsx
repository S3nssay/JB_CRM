import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const TestSmsPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [result, setResult] = useState<null | { success: boolean; message: string; error?: string }>(null);
  const [loading, setLoading] = useState(false);
  const [twilioConfig, setTwilioConfig] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.twilioConfig) {
        setTwilioConfig(data.twilioConfig);
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
            <CardTitle className="text-2xl font-bold text-[#0E6BFF]">Test SMS Functionality</CardTitle>
            <CardDescription>
              Use this form to test if the SMS system is working correctly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="Enter phone number (e.g., +447XXXXXXXXX)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Enter in international format with country code (e.g., +447XXXXXXXXX for UK)
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
                    'Send Test SMS'
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
            {twilioConfig && (
              <div className="w-full mt-4 text-xs text-slate-500">
                <h3 className="font-semibold mb-1">Twilio Configuration:</h3>
                <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(twilioConfig, null, 2)}
                </pre>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default TestSmsPage;