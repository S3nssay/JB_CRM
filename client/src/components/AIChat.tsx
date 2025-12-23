import { useState, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: number;
  userId: string;
  message: string;
  isUserMessage: boolean;
  createdAt: string;
}

const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Generate a unique user ID for the chat session
    setUserId(uuidv4());
    
    // Add initial bot message when chat is first opened
    setMessages([
      {
        id: 0,
        userId: 'system',
        message: "Hi there! I'm your virtual property assistant. How can I help you today?",
        isUserMessage: false,
        createdAt: new Date().toISOString()
      }
    ]);
  }, []);

  useEffect(() => {
    // Scroll to bottom of messages when new ones are added
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;
    
    const userMessage = {
      id: messages.length,
      userId,
      message: inputMessage,
      isUserMessage: true,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/chat', 'POST', {
        message: inputMessage,
        userId
      });
      
      setMessages(prev => [...prev, response.message]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={toggleChat}
        className="h-14 w-14 rounded-full shadow-lg"
        variant="secondary"
        aria-label="Chat with us"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 md:w-96 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="bg-secondary p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                <h3 className="font-bold">Property Assistant</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleChat}
                className="h-8 w-8 text-white hover:bg-secondary-light"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="chat-messages p-4 h-80 overflow-y-auto">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-message flex mb-4 ${msg.isUserMessage ? 'justify-end' : ''}`}
              >
                <div 
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.isUserMessage 
                      ? 'bg-secondary text-white' 
                      : 'bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <p>{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex">
              <Input
                type="text"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={handleInputChange}
                disabled={isLoading}
                className="flex-1 rounded-r-none text-black dark:text-white bg-white dark:bg-gray-800"
                data-testid="input-chat-message"
              />
              <Button 
                type="submit" 
                className="bg-secondary hover:bg-secondary-light text-white rounded-l-none"
                disabled={isLoading}
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

export default AIChat;
