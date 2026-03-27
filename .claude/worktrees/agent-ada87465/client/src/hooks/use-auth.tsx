import { createContext, ReactNode, useContext, useEffect, useRef, useCallback } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { LoginFormData, RegisterFormData } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Session timeout in milliseconds (10 minutes)
const SESSION_TIMEOUT = 10 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityTime';

type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  securityClearance: number;
  createdAt: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginFormData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterFormData>;
  resetActivityTimer: () => void;
  isSessionExpired: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSessionExpiredRef = useRef(false);

  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Check if session has expired based on last activity
  const checkSessionExpired = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      return elapsed > SESSION_TIMEOUT;
    }
    return false;
  }, []);

  // Reset the activity timer
  const resetActivityTimer = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    isSessionExpiredRef.current = false;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (user) {
        isSessionExpiredRef.current = true;
        // Auto logout on timeout
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        queryClient.setQueryData(["/api/user"], null);
        toast({
          title: "Session expired",
          description: "You have been logged out due to inactivity.",
          variant: "destructive",
        });
      }
    }, SESSION_TIMEOUT);
  }, [user, toast]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;

    // Reset timer on user activity - debounced to avoid too many updates
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleActivity = () => {
      // Debounce activity updates to prevent performance issues
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      }, 1000); // Only update every second at most
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize activity timestamp
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (debounceTimer) clearTimeout(debounceTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user]); // Only depend on user, not resetActivityTimer

  // Check session on mount and when returning to page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        if (checkSessionExpired()) {
          isSessionExpiredRef.current = true;
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          queryClient.setQueryData(["/api/user"], null);
          toast({
            title: "Session expired",
            description: "You have been logged out due to inactivity.",
            variant: "destructive",
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check on mount
    if (user && checkSessionExpired()) {
      isSessionExpiredRef.current = true;
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      queryClient.setQueryData(["/api/user"], null);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, checkSessionExpired, toast]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginFormData) => {
      // apiRequest already returns parsed JSON, no need to call .json()
      return await apiRequest("POST", "/api/auth/login", credentials);
    },
    onSuccess: () => {
      refetch();
      resetActivityTimer(); // Start session timer on login
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterFormData) => {
      // apiRequest already returns parsed JSON, no need to call .json()
      return await apiRequest("POST", "/api/register", credentials);
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Registration successful",
        description: "Your account has been created",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      localStorage.removeItem(LAST_ACTIVITY_KEY); // Clear activity timer on logout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        resetActivityTimer,
        isSessionExpired: isSessionExpiredRef.current,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}