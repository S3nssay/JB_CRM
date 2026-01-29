import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Lock, User, Building2 } from 'lucide-react';
import { AsciiScene } from '@/components/ascii-effect';

export default function CRMLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auth/login', 'POST', data);

      // Store auth token if needed
      if (response.token) {
        localStorage.setItem('authToken', response.token);
      }

      // Store user info
      localStorage.setItem('user', JSON.stringify(response.user));

      // Show toast message
      toast({
        title: "Welcome back!",
        description: `Logged in as ${response.user.fullName}`,
      });

      // Small delay before redirect to ensure state is properly set
      // This helps prevent rendering issues during page transition
      setTimeout(() => {
        setLocation('/crm/dashboard');
      }, 100);
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#791E75]">
      {/* ASCII Effect Background with Mouse Distortion */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#791E75] via-[#5d1759] to-[#791E75]">
        {/*
        <Suspense fallback={<div className="w-full h-full bg-[#0a0a0a]" />}>
          <AsciiScene
            color="#791E75"
            backgroundColor="#0a0a0a"
            fontSize={8}
            cellSize={5}
            variant="abstract"
            animationSpeed={0.8}
            mouseGlowEnabled={true}
            mouseGlowRadius={150}
            mouseGlowIntensity={2.0}
            distortionEnabled={true}
            distortionStrength={0.04}
            height="100vh"
          />
        </Suspense>
        */}
      </div>

      {/* Login Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <Building2 className="h-12 w-12 text-[#F8B324]600" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">John Barclay CRM</CardTitle>
            <CardDescription className="text-center">
              Estate & Management System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            placeholder="Enter your username"
                            className="pl-10"
                            data-testid="input-username"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your password"
                            className="pl-10"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-[#F8B324] text-black 600 hover:bg-[#F8B324] text-black 700"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Logging in..." : "Login to CRM"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>Demo Credentials:</p>
              <p className="font-mono mt-1">admin / admin123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}