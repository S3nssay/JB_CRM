import { useState, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, X, Send, Sparkles, Home, MapPin, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';

interface SearchMessage {
  id: number;
  message: string;
  isUserMessage: boolean;
  properties?: any[];
}

const AISearchBubble = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SearchMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const exampleQueries = [
    "Find me a 2-bed flat in Notting Hill under £3000",
    "Show houses with gardens in Maida Vale",
    "Properties near good schools in Kilburn"
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 0,
          message: "Hi! I'm your AI property search assistant. Tell me what you're looking for in natural language, and I'll find matching properties for you.",
          isUserMessage: false
        }
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleSearch = () => {
    setIsOpen(!isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    const userMessage: SearchMessage = {
      id: messages.length,
      message: inputMessage,
      isUserMessage: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/ai-property-search', 'POST', {
        query: inputMessage
      });
      
      const botMessage: SearchMessage = {
        id: messages.length + 1,
        message: response.message || `Found ${response.properties?.length || 0} matching properties.`,
        isUserMessage: false,
        properties: response.properties
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: SearchMessage = {
        id: messages.length + 1,
        message: "I couldn't process your search right now. Please try using the search filters on the property pages.",
        isUserMessage: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInputMessage(example);
  };

  const handlePropertyClick = (propertyId: number) => {
    setLocation(`/properties/${propertyId}`);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-24 z-50">
      <Button
        onClick={toggleSearch}
        className="h-14 w-14 rounded-full shadow-lg bg-[#791E75] hover:bg-[#5d1759]"
        aria-label="AI Property Search"
        data-testid="button-ai-search"
      >
        {isOpen ? <X size={24} className="text-white" /> : <Search size={24} className="text-white" />}
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 md:w-96 bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="bg-[#791E75] p-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center">
                <Sparkles className="h-5 w-5 mr-2" />
                <h3 className="font-bold">AI Property Search</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSearch}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-white/80 mt-1">Describe what you're looking for</p>
          </div>
          
          <div className="p-4 h-72 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`mb-4 ${msg.isUserMessage ? 'flex justify-end' : ''}`}
              >
                <div 
                  className={`p-3 rounded-lg max-w-[85%] ${
                    msg.isUserMessage 
                      ? 'bg-[#791E75] text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  
                  {msg.properties && msg.properties.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.properties.slice(0, 3).map((prop: any) => (
                        <button
                          key={prop.id}
                          onClick={() => handlePropertyClick(prop.id)}
                          className="w-full text-left p-2 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                          data-testid={`button-property-result-${prop.id}`}
                        >
                          <p className="text-xs font-medium truncate">{prop.title || prop.addressLine1}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            {prop.bedrooms} bed | £{prop.price?.toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {messages.length === 1 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Try these:</p>
                <div className="space-y-2">
                  {exampleQueries.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(example)}
                      className="w-full text-left p-2 text-xs bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:border-[#791E75] transition-colors flex items-start gap-2"
                      data-testid={`button-example-query-${idx}`}
                    >
                      {idx === 0 && <Home className="h-3 w-3 mt-0.5 text-gray-400 flex-shrink-0" />}
                      {idx === 1 && <MapPin className="h-3 w-3 mt-0.5 text-gray-400 flex-shrink-0" />}
                      {idx === 2 && <TrendingUp className="h-3 w-3 mt-0.5 text-gray-400 flex-shrink-0" />}
                      <span className="text-gray-600 dark:text-gray-300">"{example}"</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#791E75]"></div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Searching...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., 3 bed house with garden..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 text-sm"
                data-testid="input-ai-search"
              />
              <Button 
                type="submit" 
                size="icon"
                className="bg-[#791E75] hover:bg-[#5d1759] text-white"
                disabled={isLoading}
                data-testid="button-ai-search-submit"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISearchBubble;
