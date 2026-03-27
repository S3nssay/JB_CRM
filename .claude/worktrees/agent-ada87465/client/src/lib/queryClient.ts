import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  optionsOrMethod?: RequestInit | string,
  data?: unknown | undefined,
): Promise<T> {
  let fetchOptions: RequestInit;

  // Handle both old style (method, data) and new style (options object)
  if (typeof optionsOrMethod === 'string') {
    // Old style: apiRequest(url, 'POST', data)
    fetchOptions = {
      method: optionsOrMethod,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    };
  } else if (optionsOrMethod && typeof optionsOrMethod === 'object') {
    // New style: apiRequest(url, { method: 'POST', body: '...' })
    fetchOptions = {
      ...optionsOrMethod,
      credentials: "include",
    };
  } else {
    // No options provided, default to GET
    fetchOptions = {
      method: 'GET',
      credentials: "include",
    };
  }

  const res = await fetch(url, fetchOptions);

  await throwIfResNotOk(res);
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
