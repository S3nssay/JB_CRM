import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, HomeIcon, Info, Loader2, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";

type ValuationWithProperty = {
  id: number;
  propertyId: number;
  contactId: number;
  userId: number;
  estimatedValue: number;
  offerValue: number;
  status: string;
  createdAt: string;
  property: {
    id: number;
    addressLine1: string;
    postcode: string;
    town: string;
    propertyType: string;
    bedrooms: number;
    condition: string;
  };
};

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();

  const { data: valuations, isLoading, error } = useQuery<ValuationWithProperty[], Error>({
    queryKey: ["/api/user/valuations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/auth");
      },
    });
  };

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.fullName}</p>
        </div>
        <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
          {logoutMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Logout
        </Button>
      </div>

      <div className="my-6">
        <h2 className="text-xl font-semibold mb-4">Your Property Valuations</h2>
        
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <Card className="bg-destructive/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-destructive" />
                <p>Error loading valuations: {error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!isLoading && !error && valuations?.length === 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium">No saved valuations yet</h3>
                <p className="text-muted-foreground">
                  Get a property valuation to see it here
                </p>
                <Button asChild className="mt-4">
                  <Link href="/">Get a Valuation</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {valuations?.map((valuation) => (
            <Card key={valuation.id} className="overflow-hidden h-full flex flex-col">
              <CardHeader className="bg-primary/10 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <HomeIcon className="h-5 w-5" />
                  <span className="truncate">{valuation.property.addressLine1}</span>
                </CardTitle>
                <CardDescription>{valuation.property.postcode}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-grow">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Market Value</p>
                      <p className="text-lg font-semibold">{formatCurrency(valuation.estimatedValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cash Offer</p>
                      <p className="text-lg font-semibold text-primary">{formatCurrency(valuation.offerValue)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{valuation.property.propertyType}</span>
                    <span>•</span>
                    <span>{valuation.property.bedrooms} bedroom{valuation.property.bedrooms !== 1 ? "s" : ""}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Valuation date: {new Date(valuation.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/50 px-6 py-3 mt-auto">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/valuation/${valuation.id}`}>View Details</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}