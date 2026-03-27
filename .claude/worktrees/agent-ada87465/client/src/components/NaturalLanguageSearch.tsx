import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, MessageCircle, Sparkles, MapPin, Home, TrendingUp } from 'lucide-react';

interface NaturalLanguageSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  type: 'sales' | 'rentals' | 'commercial';
}

export default function NaturalLanguageSearch({ onSearch, placeholder, type }: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const exampleQueries = {
    sales: [
      "Find me 3 bedroom flats in Harlesden under £800k",
      "I want somewhere trendy with great coffee shops and easy access to central London",
      "I need a family home with parks nearby and excellent schools, but still feeling like London village life",
      "Show me canal-side properties with character near Little Venice"
    ],
    rentals: [
      "Find me a 2-bedroom flat in Notting Hill under £3000",
      "I want somewhere trendy with great coffee shops and easy access to central London",
      "Show me properties near good schools in family-friendly areas",
      "Find canal-side properties with strong rental yields in Maida Vale"
    ],
    commercial: [
      "Show me office spaces near Paddington station",
      "Find retail units with high foot traffic in prime locations",
      "I need warehouse space with good transport links",
      "Show me investment opportunities in up-and-coming areas"
    ]
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      await onSearch(query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  const getTypeColor = () => {
    switch (type) {
      case 'sales': return 'blue';
      case 'rentals': return 'green';
      case 'commercial': return 'purple';
      default: return 'blue';
    }
  };

  const colorClass = getTypeColor();

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-lg">
      <div className="flex items-center mb-4">
        <div className={`bg-${colorClass}-100 p-2 rounded-full mr-3`}>
          <Sparkles className={`h-5 w-5 text-${colorClass}-600`} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">AI Property Search</h3>
          <p className="text-sm text-gray-600">Describe what you're looking for in natural language</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || `Tell our AI what you're looking for... e.g., "${exampleQueries[type][0]}"`}
            className={`min-h-[100px] resize-none border-gray-300 focus:border-${colorClass}-500 focus:ring-${colorClass}-500 pr-12`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSearch();
              }
            }}
          />
          <MessageCircle className="absolute top-3 right-3 h-5 w-5 text-gray-400" />
        </div>

        <Button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className={`w-full bg-${colorClass}-600 hover:bg-${colorClass}-700 text-white font-semibold py-3 rounded-lg transition-all duration-300 flex items-center justify-center`}
        >
          {isSearching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Searching...
            </>
          ) : (
            <>
              <Search className="h-5 w-5 mr-2" />
              Search with AI
            </>
          )}
        </Button>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Try these example searches:</p>
          <div className="space-y-2">
            {exampleQueries[type].map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className={`text-left w-full p-3 rounded-lg border border-gray-200 hover:border-${colorClass}-300 hover:bg-${colorClass}-50 transition-all duration-200 text-sm text-gray-700 hover:text-${colorClass}-700`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-2 mt-0.5">
                    {index === 0 && <Home className="h-4 w-4 text-gray-400" />}
                    {index === 1 && <MapPin className="h-4 w-4 text-gray-400" />}
                    {index === 2 && <TrendingUp className="h-4 w-4 text-gray-400" />}
                    {index === 3 && <Sparkles className="h-4 w-4 text-gray-400" />}
                  </div>
                  <span>"{example}"</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          Press Cmd/Ctrl + Enter to search quickly
        </div>
      </div>
    </div>
  );
}