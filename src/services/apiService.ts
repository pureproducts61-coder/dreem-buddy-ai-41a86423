// API Service abstraction layer
// Currently uses mock data, ready for HF Spaces backend connection

interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

interface GenerateCodeResponse {
  code: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

class ApiService {
  private config: ApiConfig = {
    baseUrl: 'https://your-hf-space.hf.space',
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const stored = localStorage.getItem('dreem-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.config.baseUrl = settings.backendUrl || this.config.baseUrl;
      }
    } catch (e) {
      console.warn('Failed to load API config:', e);
    }
  }

  setConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Mock AI chat response
  async chat(messages: ChatMessage[], model: string = 'gemini'): Promise<ChatResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1500));

    // Mock responses based on user input
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content.toLowerCase() || '';

    let response = '';

    if (userContent.includes('button') || userContent.includes('বাটন')) {
      response = `এখানে একটি স্টাইলিশ বাটন কম্পোনেন্ট তৈরি করলাম:

\`\`\`tsx
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function CustomButton({ 
  children, 
  variant = 'primary',
  size = 'md',
  onClick 
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg font-medium transition-all',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        variant === 'outline' && 'border border-input bg-background hover:bg-accent',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2',
        size === 'lg' && 'px-6 py-3 text-lg'
      )}
    >
      {children}
    </button>
  );
}
\`\`\`

এই বাটনটি আপনার প্রজেক্টে যোগ করা হয়েছে! প্রিভিউতে দেখতে পারবেন।`;
    } else if (userContent.includes('navbar') || userContent.includes('navigation') || userContent.includes('নেভিগেশন')) {
      response = `Responsive navbar তৈরি করলাম:

\`\`\`tsx
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-background border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-xl font-bold">Logo</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="hover:text-primary">Home</a>
            <a href="#" className="hover:text-primary">About</a>
            <a href="#" className="hover:text-primary">Services</a>
            <a href="#" className="hover:text-primary">Contact</a>
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </nav>
  );
}
\`\`\``;
    } else if (userContent.includes('form') || userContent.includes('ফর্ম')) {
      response = `একটি সুন্দর contact form তৈরি করলাম:

\`\`\`tsx
import { useState } from 'react';

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded-lg"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg"
          rows={4}
          value={formData.message}
          onChange={(e) => setFormData({...formData, message: e.target.value})}
        />
      </div>
      <button
        type="submit"
        className="w-full bg-primary text-primary-foreground py-2 rounded-lg"
      >
        Send Message
      </button>
    </form>
  );
}
\`\`\``;
    } else {
      response = `আমি আপনার রিকোয়েস্ট বুঝতে পেরেছি। আপনি কী ধরনের কম্পোনেন্ট বা ফিচার চান তা আরও বিস্তারিত বলুন:

- **UI Components**: Button, Card, Modal, Form, Navbar, Footer
- **Features**: Authentication, Data table, Charts, File upload
- **Layouts**: Dashboard, Landing page, Blog, E-commerce

আমি আপনাকে সাহায্য করতে প্রস্তুত! 🚀`;
    }

    return {
      message: response,
      usage: {
        promptTokens: messages.reduce((acc, m) => acc + m.content.length, 0),
        completionTokens: response.length,
      },
    };
  }

  // Mock code generation
  async generateCode(prompt: string): Promise<GenerateCodeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      code: `// Generated code based on: ${prompt}`,
      files: [
        {
          path: 'src/components/Generated.tsx',
          content: `export function Generated() {\n  return <div>Generated Component</div>;\n}`,
        },
      ],
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // In production, this would hit the actual backend
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();
