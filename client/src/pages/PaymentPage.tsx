import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Receipt, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

// Initialize Stripe
let stripePromise: Promise<any> | null = null;

function CheckoutForm({ amount, description, onSuccess }: {
  amount: number;
  description: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portal`,
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "An error occurred");
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error.message,
      });
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast({
        title: "Payment Successful",
        description: `Your payment of ${formatCurrency(amount)} has been processed.`,
      });
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Amount:</span>
          <span className="text-2xl font-bold text-[#791E75]">{formatCurrency(amount)}</span>
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      <PaymentElement />

      {message && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full bg-[#791E75] hover:bg-[#791E75]/90"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {formatCurrency(amount)}
          </>
        )}
      </Button>
    </form>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function PaymentPage() {
  const [amount, setAmount] = useState<string>("100");
  const [description, setDescription] = useState<string>("Payment");
  const [paymentType, setPaymentType] = useState<string>("rent");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const { toast } = useToast();

  // Fetch Stripe config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['/api/crm/payments/config'],
    queryFn: () => apiRequest('/api/crm/payments/config'),
  });

  // Initialize Stripe
  useEffect(() => {
    if (config?.publishableKey && !stripePromise) {
      stripePromise = loadStripe(config.publishableKey);
    }
  }, [config]);

  // Fetch payment history
  const { data: paymentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/crm/payments/my-payments'],
    queryFn: () => apiRequest('/api/crm/payments/my-payments'),
  });

  // Fetch payment schedules
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/crm/payments/schedules'],
    queryFn: () => apiRequest('/api/crm/payments/schedules'),
  });

  // Create payment intent
  const createIntentMutation = useMutation({
    mutationFn: (data: { amount: number; description: string }) =>
      apiRequest('/api/crm/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initialize payment",
      });
    },
  });

  const handleCreatePayment = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
      });
      return;
    }

    createIntentMutation.mutate({
      amount: numAmount,
      description: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} - ${description}`,
    });
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setClientSecret(null);
    setAmount("100");
    setDescription("Payment");
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-2">Make payments and view your payment history</p>
        </div>

        {!config?.configured && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Payment System Not Configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Stripe is not configured. Please add your STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to the environment variables.
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="make-payment" className="space-y-6">
          <TabsList>
            <TabsTrigger value="make-payment" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Make Payment
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment History
            </TabsTrigger>
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="make-payment">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Payment Form */}
              <Card>
                <CardHeader>
                  <CardTitle>New Payment</CardTitle>
                  <CardDescription>
                    Enter payment details and proceed to checkout
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentSuccess ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Payment Successful!
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Your payment has been processed successfully.
                      </p>
                      <Button onClick={() => setPaymentSuccess(false)}>
                        Make Another Payment
                      </Button>
                    </div>
                  ) : clientSecret && stripePromise ? (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#791E75',
                          },
                        },
                      }}
                    >
                      <CheckoutForm
                        amount={parseFloat(amount)}
                        description={`${paymentType} - ${description}`}
                        onSuccess={handlePaymentSuccess}
                      />
                    </Elements>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="payment-type">Payment Type</Label>
                        <Select value={paymentType} onValueChange={setPaymentType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rent">Monthly Rent</SelectItem>
                            <SelectItem value="deposit">Security Deposit</SelectItem>
                            <SelectItem value="service">Service Charge</SelectItem>
                            <SelectItem value="maintenance">Maintenance Fee</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="amount">Amount (GBP)</Label>
                        <Input
                          id="amount"
                          type="number"
                          min="1"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Payment description"
                        />
                      </div>

                      <Button
                        onClick={handleCreatePayment}
                        disabled={!config?.configured || createIntentMutation.isPending}
                        className="w-full bg-[#791E75] hover:bg-[#791E75]/90"
                      >
                        {createIntentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Initializing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Proceed to Payment
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                  <CardDescription>
                    Secure payment processing powered by Stripe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Accepted Payment Methods</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>Credit/Debit Cards (Visa, Mastercard, Amex)</li>
                      <li>Apple Pay / Google Pay</li>
                      <li>Bank Transfers</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-gray-100 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Security</h4>
                    <p className="text-sm text-gray-600">
                      All payments are securely processed through Stripe. Your payment information is encrypted and never stored on our servers.
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Receipt</h4>
                    <p className="text-sm text-green-700">
                      You will receive an email confirmation and receipt after each successful payment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>
                  View all your past payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : paymentHistory && paymentHistory.length > 0 ? (
                  <div className="space-y-4">
                    {paymentHistory.map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{payment.description || payment.paymentType}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(payment.paymentDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(payment.amount))}</p>
                          <Badge
                            variant={payment.status === 'completed' ? 'default' : 'secondary'}
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payment history found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedules">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Payments</CardTitle>
                <CardDescription>
                  View upcoming scheduled payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedulesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : schedules && schedules.length > 0 ? (
                  <div className="space-y-4">
                    {schedules.map((schedule: any) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{schedule.description || schedule.scheduleType}</p>
                          <p className="text-sm text-gray-500">
                            Due: {new Date(schedule.dueDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-gray-400">{schedule.frequency}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(schedule.amount))}</p>
                          <Badge
                            variant={schedule.status === 'pending' ? 'outline' : 'default'}
                          >
                            {schedule.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scheduled payments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Link href="/portal">
            <Button variant="outline">Back to Portal</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
