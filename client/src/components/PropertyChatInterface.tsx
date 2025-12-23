import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiPropertySearchService, ChatMessage } from '@/services/aiPropertySearchService';
import { PropertyListing } from '@/services/propertyListingsService';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface PropertyChatInterfaceProps {
  onSearchResults?: (results: PropertyListing[], query: string) => void;
  className?: string;
}

export const PropertyChatInterface: React.FC<PropertyChatInterfaceProps> = ({
  onSearchResults,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const suggestedQueries = aiPropertySearchService.getSuggestedQueries();

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      const content = aiPropertySearchService.generateResponse('hello');
      const welcomeMessage = aiPropertySearchService.addMessage({
        type: 'assistant',
        content,
      });
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    console.log('handleSendMessage called with:', inputValue); // Debug log
    if (!inputValue.trim() || isLoading) return;

    const userQuery = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    // Add user message
    const userMessage = aiPropertySearchService.addMessage({
      type: 'user',
      content: userQuery,
    });

    setMessages(prev => [...prev, userMessage]);

    try {
      // First parse the intent
      const parseResponse = await apiRequest('/api/ai/parse', 'POST', { message: userQuery });
      console.log('Parse response:', parseResponse);

      if (parseResponse.intent === 'property_search') {
        // Handle property search by redirecting to the listings page
        const filters = parseResponse.filters || {};
        
        // Build query string from filters
        const queryParams = new URLSearchParams();
        if (filters.listingType) queryParams.append('listingType', filters.listingType);
        if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
        if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
        if (filters.bedrooms) queryParams.append('bedrooms', filters.bedrooms.toString());
        if (filters.bathrooms) queryParams.append('bathrooms', filters.bathrooms.toString());
        if (filters.propertyType && filters.propertyType.length > 0) {
          filters.propertyType.forEach((type: string) => queryParams.append('propertyType', type));
        }
        if (filters.areas && filters.areas.length > 0) {
          filters.areas.forEach((area: string) => queryParams.append('area', area));
        }
        if (filters.postcode) queryParams.append('postcode', filters.postcode);

        // Add a quick acknowledgment message before redirecting
        const assistantMessage = aiPropertySearchService.addMessage({
          type: 'assistant',
          content: `Searching for properties... Redirecting to results page...`,
          searchResults: [],
          searchQuery: filters,
        });

        setMessages(prev => [...prev, assistantMessage]);
        
        // Close the chat and redirect
        setTimeout(() => {
          setIsOpen(false);
          const queryString = queryParams.toString();
          setLocation(queryString ? `/properties?${queryString}` : '/properties');
        }, 500);
      } else {
        // Handle conversational queries
        const chatResponse = await apiRequest('/api/ai/chat', 'POST', { message: userQuery });
        
        const assistantMessage = aiPropertySearchService.addMessage({
          type: 'assistant',
          content: chatResponse.message || 'How can I help you find your perfect property?',
          searchResults: [],
          searchQuery: {},
        });

        setMessages(prev => [...prev, assistantMessage]);
      }

    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = aiPropertySearchService.addMessage({
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your query.',
      });
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/^(•|\*|\-)\s/gm, '<span class="bullet">•</span> ');
  };

  if (!isOpen) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-[#791E75] hover:bg-[#791E75] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
          size="sm"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <div className="w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#791E75] text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5" />
            <div>
              <h3 className="font-semibold">Property Assistant</h3>
              <p className="text-xs text-purple-100">Ask me about properties in natural language</p>
            </div>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-[#791E75]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-[#791E75] text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div
                  className="text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: formatMessage(message.content)
                  }}
                />
                {message.searchResults && message.searchResults.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs text-gray-600">
                      Found {message.searchResults.length} properties - check the results below the chat!
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Lightbulb className="w-4 h-4" />
                <span>Try asking:</span>
              </div>
              {suggestedQueries.slice(0, 4).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-2 text-sm text-gray-700 bg-gray-50 hover:bg-purple-50 hover:text-[#791E75] rounded-lg transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching properties...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about properties..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm bg-gray-100 text-gray-900 placeholder:text-gray-500 caret-gray-900"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[#791E75] hover:bg-[#791E75]"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};