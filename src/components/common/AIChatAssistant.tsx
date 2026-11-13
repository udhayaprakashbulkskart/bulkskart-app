import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Send, Bot, Sparkles, User, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { WHATSAPP_DISPLAY, WHATSAPP_MESSAGE_URL } from '@/lib/supportContact';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const SUGGESTIONS = [
  'How do I post a bulk requirement?',
  'What is MOQ and how do I negotiate?',
  'How do I compare supplier quotes?',
  'How does BulkSkart verify suppliers?',
  'Can I request a product sample?',
  'How does escrow trade protection work?',
];

const KB: Record<string, string> = {
  'moq': 'MOQ stands for Minimum Order Quantity — the smallest order a manufacturer or wholesaler accepts. You will see it listed on every product page. If your required quantity is below MOQ, consider posting a custom RFQ; suppliers often negotiate based on current production runs.',
  'rfq': 'An RFQ (Request for Quotation) lets you detail your exact bulk need — product specifications, target quantity, packaging, and delivery destination. BulkSkart matches verified suppliers who respond directly with competitive price quotations.',
  'post': 'To post an RFQ, click "Post Requirement" in the top navigation or your Buyer Dashboard. Provide specifications, target quantity, delivery location, and required dispatch timeline. Suppliers respond within 24–48 hours.',
  'compare': 'From your Buyer Dashboard under "Requirements", click "View Quotes". Received supplier quotations are presented side-by-side with unit price, MOQ, delivery timeline, supplier factory rating, and verification badge.',
  'sample': 'On any product detail page, click "Request Sample". Specify sample quantity (typically 1–10 units) and your destination address. The manufacturer reviews and coordinates sample dispatch for testing.',
  'verif': 'BulkSkart authenticates enterprises via GST registration, PAN number, IEC code for foreign trade, physical premises verification, and industrial certifications (ISO/CE). Verified companies display a green shield badge.',
  'escrow': 'BulkSkart Trade Assurance holds funds securely in escrow until you inspect and confirm receipt of goods according to specifications. Contact trade support to enable escrow protection on your order.',
  'payment': 'BulkSkart supports secure payments via Razorpay (UPI, Net Banking, NEFT/RTGS, Corporate Cards) as well as offline Letter of Credit (L/C) and Documents Against Payment (D/P) for bulk industrial shipments.',
  'free delivery': 'Delivery is free on every order placed on BulkSkart. No delivery fee is added at checkout, for any order value or category. See the offer on the homepage (#order-benefits) or at /loan-calculator.',
  'delivery fee': 'Your delivery fee on BulkSkart is ₹0. Free delivery applies to all orders on this platform.',
  'emi': 'Use the order loan calculator on the homepage or at /loan-calculator. Enter the order value, down payment, annual rate, and tenure to see the monthly installment. Delivery on the order stays free. The result is a planning estimate, not a credit approval.',
  'loan': 'Use the order loan calculator on the homepage or at /loan-calculator. Set the order value, then submit a loan request with your name, company, phone, email, city, and the amount you want financed. Delivery stays free. Submitting a request is not a loan approval.',
  'shipping': 'Every order placed on BulkSkart includes free delivery, so your checkout delivery charge is ₹0. The Shipping Calculator (/shipping-calculator) shows the freight cost BulkSkart covers. You can also estimate an order installment at /loan-calculator.',
  'deliver': 'Delivery is free on every order placed on BulkSkart. No delivery fee is added at checkout, for any order value or category. Lead time still depends on the supplier and the route. Estimate a monthly installment at /loan-calculator.',
  'bulk price': 'Product pages feature tiered wholesale pricing. As order volume increases, price brackets drop automatically. You can also negotiate custom contract pricing via direct chat.',
  'setup': 'You can complete your official business registration anytime via the 5-step Business Setup Wizard (/business-setup). It configures your company details, products, MOQ, and verification credentials.',
  'lead': 'Verified manufacturers and suppliers receive real-time RFQ leads matched to their registered product categories. Premium subscribers gain access to instant buyer direct contact information.',
  'whatsapp': `Message BulkSkart support on WhatsApp at ${WHATSAPP_DISPLAY}, or open the chat here: ${WHATSAPP_MESSAGE_URL}`,
  'support': `For support, email info@bulkskart.com or message BulkSkart on WhatsApp at ${WHATSAPP_DISPLAY}: ${WHATSAPP_MESSAGE_URL}`,
};

function getResponse(q: string): string {
  const lower = q.toLowerCase();
  for (const [key, ans] of Object.entries(KB)) {
    if (lower.includes(key)) return ans;
  }
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
    return 'Hello! I am your BulkSkart AI Trade Assistant. I can assist you with posting RFQs, comparing quotes, MOQ negotiation, verified manufacturer matching, logistics, and account verification. How can I assist you today?';
  }
  if (lower.includes('thank')) {
    return 'You are welcome! Let me know if you need assistance with any other bulk sourcing or manufacturing requirements. Happy trading on BulkSkart! 🤝';
  }
  return 'I can assist you with: posting RFQs, comparing supplier quotes, understanding MOQ, manufacturer verification, trade assurance, and shipping calculators. What would you like to explore?';
}

export default function AIChatAssistant() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Storage key strictly isolated by authenticated user ID
  const storageKey = `bulkskart_ai_chat_${user?.id || 'guest'}`;

  const defaultGreeting: Message = {
    role: 'assistant',
    content: `Hi${profile?.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}! 👋 I am your BulkSkart AI Platform Assistant. How can I help you today with bulk sourcing, supplier verification, or trade quotes?`,
    timestamp: new Date().toISOString(),
  };

  const [messages, setMessages] = useState<Message[]>([defaultGreeting]);

  // Load chat history when user changes or mounts
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setMessages([defaultGreeting]);
  }, [user?.id, storageKey]);

  // Persist messages whenever they change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  // Scroll to bottom on message updates
  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, typing]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [open]);

  // External open trigger listener
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-ai-chat', handleOpen);
    return () => window.removeEventListener('open-ai-chat', handleOpen);
  }, []);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setMessages([defaultGreeting]);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const userMsg: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setTimeout(() => {
      const reply = getResponse(trimmed);
      const assistantMsg: Message = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setTyping(false);
    }, 600 + Math.random() * 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto adjust height
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 110)}px`;
  };

  // Do not show floating assistant on full-page negotiation rooms
  if (location.pathname.includes('/negotiation')) {
    return null;
  }

  return (
    <>
      {/* Floating launcher button: positioned safely with clean clearance above content CTA rows */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`fixed bottom-24 sm:bottom-28 right-2 sm:right-3 z-30 flex items-center justify-center rounded-full shadow-xl transition-all duration-200 border border-white/20 select-none ${
          open
            ? 'w-10 h-10 md:w-auto md:px-3 md:py-2 bg-muted text-foreground border-border'
            : 'w-12 h-12 md:w-auto md:px-3.5 md:py-2 bg-[#FF5A00] text-white hover:bg-[#e04e00] hover:scale-105 active:scale-95 shadow-[0_8px_28px_rgba(255,90,0,0.45)]'
        }`}
        aria-label="BulkSkart AI Platform Trade Support"
      >
        {open ? (
          <>
            <X className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs font-bold md:ml-1.5">Close</span>
          </>
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <Bot className="w-5 h-5 md:w-4 md:h-4" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#FF5A00]" />
            </div>
            <span className="hidden md:inline text-xs font-bold tracking-tight md:ml-1.5">AI Trade Help</span>
          </>
        )}
      </button>

      {/* Chat Window: z-[70] ensures it renders on top of MobileBottomNav and all widgets */}
      {open && (
        <div
          className="bs-glass fixed inset-x-2 bottom-20 md:bottom-24 md:right-6 md:left-auto md:w-[390px] max-w-[calc(100vw-1rem)] shadow-2xl rounded-3xl border border-primary/20 bg-card flex flex-col overflow-hidden z-[70]"
          style={{ height: 'min(520px, 76vh)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#FF5A00] text-white shrink-0">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">BulkSkart AI Trade Support</p>
              <p className="text-[10px] text-white/85 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full shrink-0" />
                Live B2B Assistant · Isolated Session
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Clear chat history"
                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 rounded-lg text-white/80 hover:text-white transition-colors"
                aria-label="Clear chat history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close assistant"
                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 rounded-lg text-white transition-colors"
                aria-label="Close assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <a
            href={WHATSAPP_MESSAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 px-4 py-2 bg-[#25D366]/10 border-b border-border text-[11px] font-semibold text-[#128C7E] hover:bg-[#25D366]/15"
          >
            <span>Message BulkSkart on WhatsApp</span>
            <span className="font-mono">{WHATSAPP_DISPLAY}</span>
          </a>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-background/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'assistant'
                      ? 'bg-[#FF5A00]/15 text-[#FF5A00]'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {m.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs md:text-sm text-pretty leading-relaxed ${
                    m.role === 'assistant'
                      ? 'bg-muted/90 text-foreground rounded-tl-none border border-border/40 shadow-xs'
                      : 'bg-[#FF5A00] text-white rounded-tr-none shadow-sm font-normal'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {typing && (
              <div className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-3.5 py-2.5 flex items-center gap-1.5 border border-border/40">
                  <span className="w-1.5 h-1.5 bg-[#FF5A00] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#FF5A00] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[#FF5A00] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Suggestions (shown when few messages) */}
          {messages.length <= 2 && !typing && (
            <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-t border-border/30 bg-muted/20 scrollbar-none">
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] whitespace-nowrap bg-background text-primary border border-primary/25 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors shrink-0 font-medium active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-2.5 md:p-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about RFQs, MOQ, quotes, trade assurance..."
                  rows={1}
                  disabled={typing}
                  className="w-full bg-input border border-border rounded-xl text-base md:text-xs px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary focus:border-primary min-h-[38px] max-h-[110px] text-foreground placeholder:text-muted-foreground/70 leading-normal"
                />
              </div>

              <Button
                type="button"
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || typing}
                className="h-9 w-9 rounded-xl bg-[#FF5A00] text-white hover:bg-[#e04e00] shrink-0 disabled:opacity-40 transition-all active:scale-95"
                aria-label="Send message"
              >
                {typing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-muted-foreground/80">
              <span className="hidden md:inline">Press Enter to send, Shift+Enter for newline</span>
              <span className="md:hidden">Tap send to ask question</span>
              <span>BulkSkart Assistant</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
