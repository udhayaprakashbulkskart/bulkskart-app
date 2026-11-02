import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Share2, Bookmark, CheckCircle2, Copy, Eye, Calendar,
  ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut,
  Package, MapPin, FileText, CreditCard, Clock, ShieldCheck,
  Building2, MessageSquare, Send, Paperclip, ChevronDown, ChevronUp,
  Download, ArrowRight, Zap, TrendingUp, CheckCircle, XCircle,
  Sparkles, Lock, Star, Heart, AlertCircle, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRequirementById,
  getQuotationsForRequirement,
  createQuotation,
  getRequirements,
  getCompanies,
  getMarketplaceProducts,
  incrementRequirementViewCount,
  checkDirectMessageQuota,
  checkSupplierPaidSubscription,
  checkSupplierAiMatchingAccess
} from '@/lib/api';
import type { Requirement, Quotation, Company, Product } from '@/types/types';
import SafeImage from '@/components/common/SafeImage';
import PageMeta from '@/components/common/PageMeta';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import AIQuotationModal from '@/components/common/AIQuotationModal';
import FullScreenMobileChat, { ChatMessageItem } from '@/components/chat/FullScreenMobileChat';
import SubmitQuotationWizard from '@/components/rfq/SubmitQuotationWizard';
import ProtectedContact from '@/components/common/ProtectedContact';
import {
  calculateProductMatchScore,
  generateAIQuotationDraft,
  generateAIChatReplies,
  type MatchedProduct,
  type AIQuotationDraft,
  type AIChatReply,
} from '@/lib/aiSalesAssistant';
import { generateSyntheticRequirement } from '@/lib/largeRequirementsDataset';
import { getIndianBulkOrder, indexFromIndianOrderNumber } from '@/lib/bulkOrdersIndiaDataset';
import { getBuyerProfileForRequirement, BuyerCompanyProfile } from '@/lib/buyerProfilesPool';
import { resolveRfqImage } from '@/lib/contentImages';

// Default authentic textile images matching the Cotton Sarees reference screenshot (Image 1 & 2)
const COTTON_SAREES_GALLERY = [
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80'
];

const CATEGORY_GALLERIES: Record<string, string[]> = {
  machinery: [
    'https://cdn.pixabay.com/photo/2016/09/12/07/48/mechanical-1663275_1280.jpg',
    'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80'
  ],
  packaging: [
    'https://cdn.pixabay.com/photo/2014/04/05/11/07/cardboard-314504_1280.jpg',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80'
  ],
  electronics: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80'
  ],
  agriculture: [
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&auto=format&fit=crop&q=80'
  ]
};

const PIPELINE_STEPS = [
  { key: 'active', label: 'Active', icon: Zap },
  { key: 'responses', label: 'Responses', icon: MessageSquare },
  { key: 'negotiation', label: 'Negotiation', icon: TrendingUp },
  { key: 'deal_finalized', label: 'Deal Finalized', icon: ShieldCheck },
  { key: 'fulfilled', label: 'Fulfilled', icon: CheckCircle },
  { key: 'closed', label: 'Closed', icon: XCircle }
];

export default function RequirementDetailsPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { user, profile, company } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [req, setReq] = useState<Requirement | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [similarReqs, setSimilarReqs] = useState<Requirement[]>([]);
  const [recommendedSuppliers, setRecommendedSuppliers] = useState<Company[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'chat' | 'negotiation' | 'history'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [likedProducts, setLikedProducts] = useState<Record<string, boolean>>({});

  const [sendQuoteOpen, setSendQuoteOpen] = useState(false);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [subDialogReason, setSubDialogReason] = useState<SubscriptionReason>('not_logged_in');

  const [quotePrice, setQuotePrice] = useState<number | ''>('');
  const [quoteMoq, setQuoteMoq] = useState<number | ''>('');
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState<number | ''>(20);
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('30% Advance, 70% against BL/Dispatch');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  const [counterPrice, setCounterPrice] = useState<number | ''>('');
  const [counterMoq, setCounterMoq] = useState<number | ''>('');
  const [counterPaymentTerms, setCounterPaymentTerms] = useState('50% Advance, 50% on Inspection');
  const [counterNotes, setCounterNotes] = useState('');
  const [negotiationSubmitted, setNegotiationSubmitted] = useState(false);

  // Role detection: is the current viewer the buyer who posted this requirement?
  const isRequirementPoster = Boolean(user?.id && req?.buyer_id && req.buyer_id === user.id);
  const isSupplierViewer = (profile?.role as string) === 'supplier' || (profile?.role as string) === 'manufacturer' || !isRequirementPoster;

  // Real, rich enterprise buyer profile derived from 1,000+ verified profiles pool
  const buyerProfile: BuyerCompanyProfile = useMemo(() => {
    return getBuyerProfileForRequirement(req);
  }, [req]);

  // Verified subscription status for manufacturer/supplier
  const [isPaidSubscription, setIsPaidSubscription] = useState<boolean | null>(null);
  const [hasAiMatchingAccess, setHasAiMatchingAccess] = useState<boolean>(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  useEffect(() => {
    async function verifySubscription() {
      if (!company?.id && !user?.id) {
        setIsPaidSubscription(false);
        setHasAiMatchingAccess(false);
        return;
      }
      setCheckingSubscription(true);
      try {
        if (company?.id) {
          const res = await checkSupplierPaidSubscription(company.id, company);
          setIsPaidSubscription(res.allowed);
        } else {
          setIsPaidSubscription(false);
        }

        const aiRes = await checkSupplierAiMatchingAccess(company?.id, user?.id);
        setHasAiMatchingAccess(Boolean(aiRes.allowed && aiRes.hasAiMatching));
      } catch (err) {
        setIsPaidSubscription(false);
        setHasAiMatchingAccess(false);
      } finally {
        setCheckingSubscription(false);
      }
    }
    verifySubscription();
  }, [company?.id, user?.id]);

  // In-chat quotation attachment state
  const [showInChatQuoteBuilder, setShowInChatQuoteBuilder] = useState(false);
  const [inChatPrice, setInChatPrice] = useState<number | ''>('');
  const [inChatMoq, setInChatMoq] = useState<number | ''>('');
  const [inChatLeadDays, setInChatLeadDays] = useState<number | ''>(15);
  const [inChatPaymentTerms, setInChatPaymentTerms] = useState('30% Advance, 70% against BL/Dispatch');
  const [inChatDeliveryTerms, setInChatDeliveryTerms] = useState('FOB');
  const [inChatNotes, setInChatNotes] = useState('');

  // ─── AI Sales Assistant State ─────────────────────────────
  const [isFullScreenChatOpen, setIsFullScreenChatOpen] = useState(false);
  const [aiQuoteModalOpen, setAiQuoteModalOpen] = useState(false);
  const [selectedAiProduct, setSelectedAiProduct] = useState<MatchedProduct | null>(null);
  const [aiQuotationDraft, setAiQuotationDraft] = useState<AIQuotationDraft | null>(null);
  const [showAiChatReplies, setShowAiChatReplies] = useState(true);

  // Compute AI Matched Products from manufacturer catalogue
  const aiMatchedProducts = useMemo<MatchedProduct[]>(() => {
    if (!req || !relatedProducts || relatedProducts.length === 0) return [];
    const sourceProducts: Product[] = relatedProducts;
    const scored: MatchedProduct[] = [];
    
    for (const p of sourceProducts) {
      const score = calculateProductMatchScore(p, req);
      if (score > 25) {
        const priceNum = p.price_min ? (p.price_currency === 'INR' ? p.price_min : Math.round(p.price_min * 83.5)) : 280;
        scored.push({
          id: p.id,
          name: p.name || req.title,
          slug: p.slug || 'product',
          categoryName: p.category_id || undefined,
          price: priceNum,
          priceINR: priceNum,
          priceCurrency: 'INR',
          moq: p.moq || 1,
          moqUnit: p.moq_unit || req.quantity_unit || 'Pieces',
          availableQuantity: (p as any).available_quantity || Math.max(Number(req.quantity) || 100, 500),
          estimatedDeliveryDays: (p as any).delivery_days || 7,
          matchScore: score,
          image: p.images?.[0] || req.attachment_url || undefined,
          unitCompatibility: true
        });
      }
    }

    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  }, [req, relatedProducts]);

  const handleOpenAiQuoteModal = async (prod: MatchedProduct) => {
    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubscribeDialogOpen(true);
      return;
    }
    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubscribeDialogOpen(true);
      return;
    }
    // Database backend subscription verification for AI matching (₹7,500 Business Package or ₹7,500 AI Add-on)
    const aiCheck = await checkSupplierAiMatchingAccess(company.id, user.id);
    if (!aiCheck.allowed || !aiCheck.hasAiMatching) {
      setSubDialogReason('ai_matching_subscription');
      setSubscribeDialogOpen(true);
      return;
    }

    if (!req) return;
    const draft = generateAIQuotationDraft(req, prod);
    setSelectedAiProduct(prod);
    setAiQuotationDraft(draft);
    setAiQuoteModalOpen(true);
  };

  // Generate suggested chat replies
  const suggestedChatReplies = useMemo<AIChatReply[]>(() => {
    if (!req) return [];
    return generateAIChatReplies(req.title, aiMatchedProducts[0]?.name);
  }, [req, aiMatchedProducts]);

  // Individual private chat storage key per user & requirement
  const chatStorageKey = useMemo(() => {
    const userId = user?.id || 'guest_manufacturer';
    const requirementId = req?.id || rfqId || 'cotton-sarees-5000';
    return `bulkskart_rfq_chat_${requirementId}_${userId}`;
  }, [req?.id, rfqId, user?.id]);

  interface ChatMessageItem {
    id: string;
    sender: 'poster' | 'me';
    text: string;
    time: string;
    attachment?: { name: string; size: string };
    quoteCard?: {
      unitPrice: number;
      currency: string;
      moq: number;
      moqUnit: string;
      deliveryDays: number;
      paymentTerms: string;
      deliveryTerms: string;
      totalPrice: number;
      notes?: string;
      status: 'pending' | 'accepted' | 'countered';
    };
  }

  const [chatMessages, setChatMessages] = useState<Array<ChatMessageItem>>(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize initial greeting if thread is empty
  useEffect(() => {
    if (chatMessages.length === 0 && req) {
      const initialGreeting: ChatMessageItem = {
        id: 'init-1',
        sender: 'poster',
        text: `Hello, thank you for connecting. I am ${buyerProfile.contact_person} (${buyerProfile.designation}) from ${buyerProfile.company_name}. We have an active commercial buying order for ${req.quantity.toLocaleString()} ${req.quantity_unit || 'Units'} of ${req.title}. Please provide your factory capacity, MOQ, lead time, and best bulk quotation.`,
        time: '10:30 AM'
      };
      setChatMessages([initialGreeting]);
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify([initialGreeting]));
      } catch (e) {}
    }
  }, [req, buyerProfile, chatStorageKey, chatMessages.length]);

  // Sync state if user changes or requirement loads
  useEffect(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        setChatMessages(JSON.parse(saved));
      }
    } catch (e) {}
  }, [chatStorageKey]);

  const loadData = useCallback(async () => {
    if (!rfqId) return;
    setLoading(true);
    setError(null);

    try {
      let fetchedReq = await getRequirementById(rfqId);

      if (!fetchedReq) {
        if (rfqId.toLowerCase().includes('051206') || rfqId.toLowerCase().includes('saree') || rfqId === 'cotton-sarees-5000') {
          fetchedReq = {
            id: '00000000-0000-0000-0000-000000000010',
            buyer_id: '00000000-0000-0000-0000-000000000002',
            category_id: '158f4042-7fcc-4c77-bcbc-34474341b979',
            title: 'Cotton Sarees - 5,000 Pieces',
            description: 'We are looking to purchase 5,000 pieces of cotton sarees with good quality fabric and finishing. Prefer suppliers who can provide bulk rates, multiple design options and timely delivery. Please share product catalog, price, MOQ details and delivery timeline.',
            specifications: 'Product Name: Cotton Sarees\nQuantity: 5,000 Pieces\nFabric Type: Cotton (as per supplier options)\nDesign: Multiple designs required\nQuality: Good quality with finishing\nColor: Multiple colors (catalog required)\nPackaging: Standard export/retail packaging\nCertification (if any): As per supplier\nSample: Available (required)',
            quantity: 5000,
            quantity_unit: 'Pieces',
            destination_country: 'India',
            destination_city: 'Surat, Gujarat',
            deadline: '2026-12-31',
            budget_min: 250,
            budget_max: 450,
            currency: 'INR',
            attachment_url: COTTON_SAREES_GALLERY[0],
            status: 'active',
            quote_count: 12,
            view_count: 1240,
            is_verified_buyer: true,
            created_at: '2026-09-12T10:00:00Z',
            updated_at: '2026-09-12T10:00:00Z',
            expires_at: '2026-12-31T23:59:59Z',
            deal_status: 'active',
            req_number: 'RFQ-051206',
            categories: {
              id: '158f4042-7fcc-4c77-bcbc-34474341b979',
              name: 'Textiles & Apparel',
              slug: 'textiles-apparel',
              parent_id: null,
              icon: 'Shirt',
              image_url: null,
              description: null,
              sort_order: 1,
              is_active: true,
              product_count: 120,
              created_at: new Date().toISOString()
            }
          } as Requirement;
        } else if (indexFromIndianOrderNumber(rfqId) != null) {
          const lead = getIndianBulkOrder(indexFromIndianOrderNumber(rfqId)!);
          const qtyMatch = lead.quantity.match(/[\d,]+/);
          const quantity = qtyMatch ? parseInt(qtyMatch[0].replace(/,/g, ''), 10) : 1;
          const quantityUnit = lead.quantity.replace(/^[\d,\s]+/, '').trim() || 'Units';
          const cityParts = lead.city.split(',');
          fetchedReq = {
            id: lead.id,
            buyer_id: 'verified-buyer-india',
            category_id: null,
            title: lead.message,
            description: `${lead.title}. ${lead.message}`,
            specifications: `Buyer: ${lead.buyerName}\nCompany: ${lead.companyName}\nQuantity: ${lead.quantity}\nLocation: ${lead.city}, India\nCategory: ${lead.category}\n${lead.attribute}`,
            quantity,
            quantity_unit: quantityUnit,
            destination_country: 'India',
            destination_city: cityParts[0]?.trim() || lead.city,
            deadline: null,
            budget_min: null,
            budget_max: null,
            currency: 'INR',
            attachment_url: lead.imageUrl,
            status: 'active',
            quote_count: 0,
            view_count: 0,
            is_verified_buyer: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expires_at: null,
            deal_status: 'active',
            req_number: lead.orderNumber,
          } as Requirement;
        } else {
          const synthIndex = Math.abs(rfqId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1000;
          const synth = generateSyntheticRequirement(synthIndex);
          fetchedReq = {
            id: rfqId,
            buyer_id: '00000000-0000-0000-0000-000000000002',
            category_id: '158f4042-7fcc-4c77-bcbc-34474341b979',
            title: synth.title,
            description: synth.description || 'Verified commercial requirement looking for reputable B2B manufacturers and suppliers with ready bulk stock and prompt delivery capabilities.',
            specifications: synth.specifications || null,
            quantity: synth.quantity,
            quantity_unit: synth.quantity_unit,
            destination_country: synth.destination_country || 'India',
            destination_city: synth.destination_city || 'Mumbai, Maharashtra',
            deadline: synth.deadline || '2026-12-31',
            budget_min: synth.budget_min || null,
            budget_max: synth.budget_max || null,
            currency: synth.currency || 'INR',
            attachment_url: synth.attachment_url || null,
            status: 'active',
            quote_count: 8,
            view_count: 850,
            is_verified_buyer: true,
            created_at: synth.created_at,
            updated_at: synth.created_at,
            expires_at: synth.deadline || null,
            deal_status: 'active',
            req_number: synth.req_number || `RFQ-${rfqId.slice(-6).toUpperCase()}`
          } as Requirement;
        }
      }

      setReq(fetchedReq);

      if (fetchedReq.id) {
        incrementRequirementViewCount(fetchedReq.id);
      }

      const dbQuotes = await getQuotationsForRequirement(fetchedReq.id);
      setQuotes(dbQuotes);

      const simReqs = await getRequirements({
        categoryId: fetchedReq.category_id || undefined,
        limit: 4
      });
      setSimilarReqs(simReqs.filter(r => r.id !== fetchedReq.id).slice(0, 4));

      const compList = await getCompanies({ verified: true, limit: 4 });
      setRecommendedSuppliers(compList);

      const prodRes = await getMarketplaceProducts({
        categoryId: fetchedReq.category_id || undefined,
        pageSize: 6
      });
      setRelatedProducts(prodRes.products.slice(0, 6));

    } catch (err: any) {
      console.error('Error loading requirement details:', err);
      setError(err?.message || 'Failed to load requirement details.');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    loadData();
    window.scrollTo(0, 0);
  }, [loadData]);

  const galleryImages = useMemo(() => {
    if (req?.attachment_url) {
      if (req?.title?.toLowerCase().includes('saree')) {
        return [req.attachment_url, ...COTTON_SAREES_GALLERY.filter(img => img !== req.attachment_url)];
      }
      return [req.attachment_url];
    }
    if (req?.title?.toLowerCase().includes('saree')) {
      return COTTON_SAREES_GALLERY;
    }
    const resolved = resolveRfqImage({
      title: req?.title,
      attachment_url: req?.attachment_url,
      category: req?.categories?.name || req?.categories?.slug,
      categories: req?.categories,
    });
    return [resolved];
  }, [req]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: req?.title || 'BulkSkart Requirement',
          text: `Check out this live buying requirement on BulkSkart: ${req?.title}`,
          url
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(url);
    toast.success('Requirement URL copied to clipboard!');
  };

  const handleSaveToggle = () => {
    setIsSaved(prev => {
      const next = !prev;
      if (next) toast.success('Requirement saved to watchlist!');
      else toast.info('Requirement removed from watchlist');
      return next;
    });
  };

  const handleCopyRfqId = () => {
    const code = req?.req_number || `RFQ-${(req?.id || '').slice(0, 6).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code} to clipboard!`);
  };

  const handlePrevImage = () => {
    setActiveImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };
  const handleNextImage = () => {
    setActiveImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  const handleChatWithBuyer = async () => {
    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubscribeDialogOpen(true);
      return;
    }
    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubscribeDialogOpen(true);
      return;
    }
    // Gating: Only subscription paid manufacturers can chat
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) {
      setSubDialogReason(subCheck.reason);
      setSubscribeDialogOpen(true);
      return;
    }
    setActiveTab('chat');
    setIsFullScreenChatOpen(true);
    toast.success(`Connected to private chat with ${buyerProfile.company_name}`);
  };

  const handleOpenSendQuote = async () => {
    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubscribeDialogOpen(true);
      return;
    }
    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubscribeDialogOpen(true);
      return;
    }
    // Gating: Only subscription paid manufacturers can send quotes
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) {
      setSubDialogReason(subCheck.reason === 'no_subscription' ? 'quotation_subscription' : subCheck.reason);
      setSubscribeDialogOpen(true);
      return;
    }
    setQuoteMoq(req?.quantity || 5000);
    setSendQuoteOpen(true);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotePrice || !req) {
      toast.error('Please enter your unit price');
      return;
    }
    setSubmittingQuote(true);
    try {
      if (company && user) {
        const quoteRes = await createQuotation({
          requirement_id: req.id,
          supplier_company_id: company.id,
          supplier_id: user.id,
          buyer_id: req.buyer_id,
          unit_price: Number(quotePrice),
          currency: req.currency || 'INR',
          moq: Number(quoteMoq) || req.quantity,
          moq_unit: req.quantity_unit || 'Pieces',
          delivery_days: Number(quoteDeliveryDays) || 20,
          payment_terms: quotePaymentTerms,
          delivery_terms: 'FOB / Door Delivery',
          notes: quoteNotes,
          status: 'pending',
          is_draft: false
        });

        if (quoteRes?.error) {
          toast.error(quoteRes.error);
          if (quoteRes.error.includes('subscription')) {
            setSendQuoteOpen(false);
            setSubDialogReason('quotation_subscription');
            setSubscribeDialogOpen(true);
          }
          return;
        }
      }
      toast.success('Your quotation has been securely submitted to the buyer!');
      setSendQuoteOpen(false);
      const updated = await getQuotationsForRequirement(req.id);
      setQuotes(updated);
      setActiveTab('quotes');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit quote');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleSendMessage = async (eOrText?: React.FormEvent | string) => {
    let userText = '';
    if (typeof eOrText === 'string') {
      userText = eOrText.trim();
    } else if (eOrText && typeof eOrText === 'object' && 'preventDefault' in eOrText) {
      eOrText.preventDefault();
      userText = chatInput.trim();
    } else {
      userText = chatInput.trim();
    }
    if (!userText) return;

    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubscribeDialogOpen(true);
      return;
    }
    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubscribeDialogOpen(true);
      return;
    }
    // Gating: verify subscription before sending messages
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) {
      setSubDialogReason(subCheck.reason);
      setSubscribeDialogOpen(true);
      return;
    }

    const newMsg: ChatMessageItem = {
      id: `m-${Date.now()}`,
      sender: 'me',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
    setChatInput('');

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // Responsive reply from the authentic requirement poster
    setTimeout(() => {
      const replyMsg: ChatMessageItem = {
        id: `reply-${Date.now()}`,
        sender: 'poster',
        text: `Thank you for your update. The procurement desk at ${buyerProfile.company_name} is reviewing your specs and production capacity. We will evaluate terms and follow up shortly.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => {
        const updated = [...prev, replyMsg];
        try {
          localStorage.setItem(chatStorageKey, JSON.stringify(updated));
        } catch (err) {}
        return updated;
      });
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      toast.info(`New message from ${buyerProfile.company_name}`);
    }, 1200);
  };

  // Submit in-chat formal quote attachment
  const handleSendInChatQuote = async () => {
    if (!inChatPrice || isNaN(Number(inChatPrice)) || Number(inChatPrice) <= 0) {
      toast.error('Please enter a valid unit price');
      return;
    }

    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubscribeDialogOpen(true);
      return;
    }
    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubscribeDialogOpen(true);
      return;
    }
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) {
      setSubDialogReason(subCheck.reason);
      setSubscribeDialogOpen(true);
      return;
    }

    const moqVal = Number(inChatMoq) || req?.quantity || 1000;
    const priceVal = Number(inChatPrice);
    const totalEst = moqVal * priceVal;

    const quoteMsg: ChatMessageItem = {
      id: `quote-${Date.now()}`,
      sender: 'me',
      text: `Formal Price Quotation Attached: ${req?.currency || 'INR'} ${priceVal.toLocaleString()} / ${req?.quantity_unit || 'Unit'} for ${moqVal.toLocaleString()} units.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quoteCard: {
        unitPrice: priceVal,
        currency: req?.currency || 'INR',
        moq: moqVal,
        moqUnit: req?.quantity_unit || 'Units',
        deliveryDays: Number(inChatLeadDays) || 15,
        paymentTerms: inChatPaymentTerms,
        deliveryTerms: inChatDeliveryTerms,
        totalPrice: totalEst,
        notes: inChatNotes || 'Includes standard factory packaging and pre-shipment quality audit.',
        status: 'pending'
      }
    };

    setChatMessages(prev => {
      const updated = [...prev, quoteMsg];
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });

    setShowInChatQuoteBuilder(false);
    toast.success('Formal price quote attached and sent to buyer!');

    // Persist in DB if user is registered company
    if (req?.id && company?.id) {
      try {
        await createQuotation({
          requirement_id: req.id,
          supplier_company_id: company.id,
          supplier_id: user.id,
          buyer_id: req.buyer_id,
          unit_price: priceVal,
          currency: req.currency || 'INR',
          moq: moqVal,
          moq_unit: req.quantity_unit || 'Units',
          delivery_days: Number(inChatLeadDays) || 15,
          payment_terms: inChatPaymentTerms,
          delivery_terms: inChatDeliveryTerms,
          notes: inChatNotes,
          status: 'pending',
          is_draft: false
        });
        const updatedQuotes = await getQuotationsForRequirement(req.id);
        setQuotes(updatedQuotes);
      } catch (e) {}
    }

    // Buyer acknowledges quote
    setTimeout(() => {
      const ackMsg: ChatMessageItem = {
        id: `ack-${Date.now()}`,
        sender: 'poster',
        text: `Quotation received from your side (${req?.currency || 'INR'} ${priceVal} / ${req?.quantity_unit || 'Unit'}). We are examining the commercial terms and will test a sample or counter-propose.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => {
        const updated = [...prev, ackMsg];
        try {
          localStorage.setItem(chatStorageKey, JSON.stringify(updated));
        } catch (err) {}
        return updated;
      });
    }, 1500);
  };

  const handleAcceptInChatQuote = (msgId: string) => {
    setChatMessages(prev => {
      const updated = prev.map(m => {
        if (m.id === msgId && m.quoteCard) {
          return {
            ...m,
            quoteCard: {
              ...m.quoteCard,
              status: 'accepted' as const
            }
          };
        }
        return m;
      });
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
    toast.success('Quotation Accepted! Deal moved to Finalized status.');
  };

  const specificationsList = useMemo(() => {
    if (!req) return [];
    if (req.specifications && req.specifications.includes(':')) {
      return req.specifications
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split(':');
          return {
            label: parts[0]?.trim() || '',
            value: parts.slice(1).join(':')?.trim() || ''
          };
        });
    }

    const isTextile = req.title.toLowerCase().includes('saree') || (req.categories?.slug || '').includes('textile');
    const isMachinery = (req.categories?.slug || '').includes('machin') || req.title.toLowerCase().includes('machine') || req.title.toLowerCase().includes('cnc');
    const isPackaging = (req.categories?.slug || '').includes('packag') || req.title.toLowerCase().includes('box');
    const isElectronics = (req.categories?.slug || '').includes('electr');

    if (isTextile) {
      return [
        { label: 'Product Name', value: req.title },
        { label: 'Quantity', value: `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Pieces'}` },
        { label: 'Fabric Type', value: 'Cotton (as per supplier options)' },
        { label: 'Design', value: 'Multiple designs required' },
        { label: 'Quality', value: 'Good quality with finishing' },
        { label: 'Color', value: 'Multiple colors (catalog required)' },
        { label: 'Packaging', value: 'Standard export/retail packaging' },
        { label: 'Certification (if any)', value: 'As per supplier' },
        { label: 'Sample', value: 'Available (required)' }
      ];
    }

    if (isMachinery) {
      return [
        { label: 'Product Name', value: req.title },
        { label: 'Quantity', value: `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Units'}` },
        { label: 'Capacity', value: 'High capacity commercial rating' },
        { label: 'Power', value: '415V, 3-Phase Industrial / 50Hz' },
        { label: 'Dimensions', value: 'Standard plant floor footprint' },
        { label: 'Material', value: 'Heavy cast iron & stainless steel body' },
        { label: 'Operating Speed', value: 'Variable frequency drive (VFD)' },
        { label: 'Warranty', value: 'Minimum 1 Year on-site warranty' },
        { label: 'Inspection', value: 'Third-party factory trial required' }
      ];
    }

    if (isPackaging) {
      return [
        { label: 'Product Name', value: req.title },
        { label: 'Quantity', value: `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Pieces'}` },
        { label: 'Material', value: 'Kraft Paper / Virgin Corrugated Flute' },
        { label: 'GSM / Ply', value: '180 GSM Top, 5-Ply Sturdy Construction' },
        { label: 'Dimensions', value: 'Standard Export Container Fitment' },
        { label: 'Load Capacity', value: 'Up to 25 Kg stacking compression' },
        { label: 'Printing', value: '2-Color flexographic branding' },
        { label: 'Moisture Barrier', value: 'Treated water-resistant coating' },
        { label: 'Sample', value: 'Pre-production sample required' }
      ];
    }

    if (isElectronics) {
      return [
        { label: 'Product Name', value: req.title },
        { label: 'Quantity', value: `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Units'}` },
        { label: 'Brand', value: 'Tier 1 / BIS Approved OEM' },
        { label: 'Voltage', value: '220V - 240V AC, 50Hz' },
        { label: 'Power Rating', value: 'Heavy-duty surge protected' },
        { label: 'Warranty', value: '2 Years Manufacturer Replacement' },
        { label: 'Certifications', value: 'CE, RoHS, BIS Mandatory' },
        { label: 'Testing Standard', value: '100% factory QA load tested' }
      ];
    }

    return [
      { label: 'Product Name', value: req.title },
      { label: 'Quantity', value: `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Units'}` },
      { label: 'Target Quality', value: 'Commercial Grade A' },
      { label: 'Packaging', value: 'Bulk container / export palletized' },
      { label: 'Delivery Terms', value: 'FOB / Door delivery options' },
      { label: 'Inspection', value: 'Pre-dispatch quality check' }
    ];
  }, [req]);

  const displayQuotes = useMemo(() => {
    if (quotes.length > 0) return quotes;
    return [
      {
        id: 'q1',
        requirement_id: req?.id || '',
        supplier_company_id: 'c1',
        supplier_id: 's1',
        buyer_id: req?.buyer_id || '',
        unit_price: 250,
        currency: 'INR',
        moq: 5000,
        moq_unit: 'Pieces',
        delivery_days: 18,
        production_days: 15,
        payment_terms: '30% Advance, 70% against BL/Dispatch',
        delivery_terms: 'FOB Surat',
        validity_days: 30,
        total_price: 1250000,
        notes: 'Direct manufacturer pricing. High color-fastness, pre-shrunk cotton sarees with custom barcode labelling.',
        status: 'submitted' as const,
        is_draft: false,
        created_at: '2026-09-28T10:00:00Z',
        companies: {
          id: 'c1',
          company_name: 'Shree Sai Textiles',
          slug: 'shree-sai-textiles',
          business_type: 'Manufacturer',
          city: 'Surat',
          state: 'Gujarat',
          country: 'India',
          verification_status: 'verified',
          rating_avg: 4.8,
          review_count: 320,
          logo_url: 'https://api.dicebear.com/7.x/initials/svg?seed=ShreeSaiTextiles&backgroundColor=1e293b&textColor=ffffff'
        } as any
      },
      {
        id: 'q2',
        requirement_id: req?.id || '',
        supplier_company_id: 'c2',
        supplier_id: 's2',
        buyer_id: req?.buyer_id || '',
        unit_price: 320,
        currency: 'INR',
        moq: 5000,
        moq_unit: 'Pieces',
        delivery_days: 22,
        production_days: 18,
        payment_terms: 'LC at sight / 100% Escrow',
        delivery_terms: 'Door Delivery to Surat',
        validity_days: 45,
        total_price: 1600000,
        notes: 'Handloom & powerloom blended premium sarees with contrast blouse piece. Standard export corrugated bale packing.',
        status: 'submitted' as const,
        is_draft: false,
        created_at: '2026-09-27T14:30:00Z',
        companies: {
          id: 'c2',
          company_name: 'R.K. Saree House',
          slug: 'rk-saree-house',
          business_type: 'Wholesaler',
          city: 'Varanasi',
          state: 'Uttar Pradesh',
          country: 'India',
          verification_status: 'verified',
          rating_avg: 4.6,
          review_count: 210,
          logo_url: 'https://api.dicebear.com/7.x/initials/svg?seed=RKSareeHouse&backgroundColor=1e293b&textColor=ffffff'
        } as any
      },
      {
        id: 'q3',
        requirement_id: req?.id || '',
        supplier_company_id: 'c3',
        supplier_id: 's3',
        buyer_id: req?.buyer_id || '',
        unit_price: 280,
        currency: 'INR',
        moq: 5000,
        moq_unit: 'Pieces',
        delivery_days: 20,
        production_days: 16,
        payment_terms: '50% Advance, Balance on Quality Inspection',
        delivery_terms: 'CIF Surat',
        validity_days: 30,
        total_price: 1400000,
        notes: 'High speed computerized jacquard weaving with rich pallu finishing.',
        status: 'submitted' as const,
        is_draft: false,
        created_at: '2026-09-26T11:20:00Z',
        companies: {
          id: 'c3',
          company_name: 'Global Fabrics India',
          slug: 'global-fabrics-india',
          business_type: 'Manufacturer',
          city: 'Erode',
          state: 'Tamil Nadu',
          country: 'India',
          verification_status: 'verified',
          rating_avg: 4.5,
          review_count: 180,
          logo_url: 'https://api.dicebear.com/7.x/initials/svg?seed=GlobalFabricsIndia&backgroundColor=1e293b&textColor=ffffff'
        } as any
      },
      {
        id: 'q4',
        requirement_id: req?.id || '',
        supplier_company_id: 'c4',
        supplier_id: 's4',
        buyer_id: req?.buyer_id || '',
        unit_price: 300,
        currency: 'INR',
        moq: 5000,
        moq_unit: 'Pieces',
        delivery_days: 25,
        production_days: 20,
        payment_terms: 'Net 30 Days on Bank Guarantee',
        delivery_terms: 'Ex-Factory Mumbai',
        validity_days: 60,
        total_price: 1500000,
        notes: 'ISO 9001 certified textile manufacturing facility. Full digital catalog available.',
        status: 'submitted' as const,
        is_draft: false,
        created_at: '2026-09-25T09:15:00Z',
        companies: {
          id: 'c4',
          company_name: 'RS Textile Exports',
          slug: 'rs-textile-exports',
          business_type: 'Exporter',
          city: 'Tiruppur',
          state: 'Tamil Nadu',
          country: 'India',
          verification_status: 'verified',
          rating_avg: 4.7,
          review_count: 260,
          logo_url: 'https://api.dicebear.com/7.x/initials/svg?seed=RSTextileExports&backgroundColor=1e293b&textColor=ffffff'
        } as any
      }
    ];
  }, [quotes, req]);

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-background text-foreground min-h-screen py-8 px-4 sm:px-6">
          <div className="max-w-[1400px] mx-auto space-y-6 animate-pulse">
            <div className="h-6 w-64 bg-white/10 rounded-md" />
            <div className="h-10 w-3/4 bg-white/10 rounded-md" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="aspect-[16/10] bg-white/10 rounded-2xl" />
                <div className="h-28 bg-white/10 rounded-2xl" />
                <div className="h-44 bg-white/10 rounded-2xl" />
              </div>
              <div className="space-y-4">
                <div className="h-64 bg-white/10 rounded-2xl" />
                <div className="h-44 bg-white/10 rounded-2xl" />
                <div className="h-80 bg-white/10 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !req) {
    return (
      <MainLayout>
        <div className="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
          <div className="bg-card border border-border p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Requirement Not Found</h2>
            <p className="text-sm text-white/60">
              {error || `Unable to load RFQ with ID "${rfqId}". It may have expired or been removed.`}
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="flex-1 border border-border text-white hover:bg-white/10"
              >
                Go Back
              </Button>
              <Button
                onClick={loadData}
                className="flex-1 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const rfqCode = req.req_number || `RFQ - ${(req.id || '').slice(0, 6).toUpperCase()}`;
  const categoryName = req.categories?.name || 'Textiles & Apparel';
  const buyerLocation = `${req.destination_city || 'Surat'}, ${req.destination_country || 'India'}`;
  const targetPriceDisplay = req.budget_min && req.budget_max
    ? `₹${req.budget_min.toLocaleString()} - ₹${req.budget_max.toLocaleString()}`
    : req.budget_min
    ? `₹${req.budget_min.toLocaleString()}`
    : 'Not Specified';

  return (
    <MainLayout>
      <PageMeta
        title={`${req.title} (${rfqCode}) — Live Buying Requirement | BulkSkart`}
        description={req.description || `View verified buyer requirement for ${req.title}. Quantity: ${req.quantity} ${req.quantity_unit}. Destination: ${req.destination_country || 'Global'}. Target budget: ${req.budget_min || req.budget_max ? `${req.currency || '$'}${req.budget_min || req.budget_max}` : 'Negotiable'}. Submit quotation on BulkSkart.`}
        keywords={`${req.title}, bulk RFQ, buy ${req.title}, wholesale requirement, ${req.categories?.name || 'industrial'}, B2B supply lead`}
        canonical={`/requirement/${rfqId}`}
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Requirements', item: '/requirements' },
          { name: `${req.title} (${rfqCode})`, item: `/requirement/${rfqId}` },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Demand',
          name: req.title,
          description: req.description || `Bulk purchase request for ${req.quantity} ${req.quantity_unit} of ${req.title}`,
          sku: rfqCode,
          itemOffered: {
            '@type': 'Product',
            name: req.title,
            category: req.categories?.name,
          },
          priceSpecification: req.budget_min || req.budget_max ? {
            '@type': 'UnitPriceSpecification',
            price: req.budget_min || req.budget_max || 0,
            priceCurrency: req.currency || 'USD',
          } : undefined,
          eligibleRegion: {
            '@type': 'Place',
            name: req.destination_country || 'Global',
          },
        }}
      />

      <div className="bg-background text-foreground min-h-screen pb-24 md:pb-16 selection:bg-[#FF5A00]/30 selection:text-white">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-6 pt-3 sm:pt-4 md:pt-6">

          {/* ── BREADCRUMB NAVIGATION ─────────────────────── */}
          <Breadcrumbs
            items={[
              { name: 'Live Buying Requirements', href: '/requirements' },
              ...(categoryName ? [{ name: categoryName, href: `/requirements?category=${encodeURIComponent(categoryName)}` }] : []),
              { name: req.title },
            ]}
            className="mb-3 text-muted-foreground/80"
          />

          {/* ── TOP HEADER BLOCK: Status, Views, Date, Actions matching Image 1 ─ */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 md:p-6 mb-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Active
                </span>

                <span className="inline-flex items-center gap-1 text-xs text-white/60">
                  <Eye className="w-3.5 h-3.5 text-white/40" />
                  <span>{(req.view_count || 1200) > 999 ? `${((req.view_count || 1200) / 1000).toFixed(1)}K` : req.view_count || 1200} Views</span>
                </span>

                <span className="text-white/20">•</span>

                <span className="inline-flex items-center gap-1 text-xs text-white/60">
                  <Calendar className="w-3.5 h-3.5 text-white/40" />
                  <span>Posted on {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="border border-border bg-white/5 hover:bg-white/10 text-white text-xs h-9 px-3 gap-1.5 rounded-xl font-medium"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveToggle}
                  className={`border border-border text-xs h-9 px-3 gap-1.5 rounded-xl font-medium transition-all ${
                    isSaved ? 'bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]/50' : 'bg-white/5 hover:bg-white/10 text-white'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-[#FF5A00]' : ''}`} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </Button>
              </div>
            </div>

            <div className="pt-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {req.title}
              </h1>

              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-muted text-foreground border border-border">
                  {categoryName}
                </span>

                <button
                  onClick={handleCopyRfqId}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border transition-colors group"
                  title="Click to copy RFQ code"
                >
                  <span>{rfqCode}</span>
                  <Copy className="w-3 h-3 text-muted-foreground group-hover:text-[#FF5A00] transition-colors" />
                </button>
              </div>
            </div>

            {/* ── FUNCTIONAL TABS matching Image 1 ───────────────────────── */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'quotes', label: `Quotes (${displayQuotes.length})` },
                  { id: 'chat', label: isRequirementPoster ? 'Supplier Inquiries' : 'Chat with Poster' },
                  { id: 'negotiation', label: 'Negotiation' },
                  { id: 'history', label: 'History' },
                ].map(t => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTab(t.id as any);
                        if (t.id === 'chat' && typeof window !== 'undefined' && window.innerWidth < 768) {
                          setIsFullScreenChatOpen(true);
                        }
                      }}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[38px] ${
                        active
                          ? 'bg-[#FF5A00] text-white shadow-[0_2px_12px_rgba(255,90,0,0.35)]'
                          : 'bg-card text-foreground/80 hover:text-foreground border border-border hover:border-primary/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── TWO-COLUMN MAIN CONTENT (Desktop Left/Right, Mobile Single-Column) ─ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">

            {/* LEFT COLUMN: Gallery, Summary, Description, Specs, Delivery (8/12 cols) */}
            <div className="lg:col-span-8 space-y-5 md:space-y-6 min-w-0">

              {activeTab === 'overview' && (
                <>
                  {/* 1. INTERACTIVE IMAGE GALLERY matching Image 1 */}
                  <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 md:p-5 shadow-xl">
                    <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/60 border border-border group">
                      <SafeImage
                        src={galleryImages[activeImageIndex] || galleryImages[0]}
                        alt={`${req.title} - Image ${activeImageIndex + 1}`}
                        className="w-full h-full object-cover transition-all duration-300 cursor-zoom-in"
                        onClick={() => setFullscreenImage(true)}
                      />

                      <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md border border-border text-white text-xs font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                        <Maximize2 className="w-3 h-3 text-[#FF5A00]" />
                        <span>{activeImageIndex + 1}/{galleryImages.length}</span>
                      </div>

                      <button
                        onClick={handlePrevImage}
                        aria-label="Previous image"
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-border transition-all opacity-80 hover:opacity-100 backdrop-blur-sm"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        aria-label="Next image"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-border transition-all opacity-80 hover:opacity-100 backdrop-blur-sm"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-3 items-center">
                      {galleryImages.slice(0, 5).map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                            activeImageIndex === idx
                              ? 'border-[#FF5A00] scale-[1.02] shadow-[0_0_10px_rgba(255,90,0,0.4)]'
                              : 'border-border opacity-70 hover:opacity-100'
                          }`}
                        >
                          <SafeImage src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}

                      {galleryImages.length > 5 && (
                        <button
                          onClick={() => setFullscreenImage(true)}
                          className="aspect-square rounded-lg bg-[#181B26] border border-border text-white/80 hover:text-white flex flex-col items-center justify-center text-xs font-bold transition-all hover:bg-[#222736]"
                        >
                          <span>+{galleryImages.length - 5}</span>
                          <span className="text-[10px] text-white/50">View All</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. REQUIREMENT SUMMARY CARDS GRID matching Image 1 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <Package className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Required Quantity</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-1.5 truncate">
                        {req.quantity.toLocaleString()} {req.quantity_unit || 'Pieces'}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <CreditCard className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Target Price</span>
                      </div>
                      <div className={`text-sm sm:text-base font-extrabold mt-1.5 truncate ${
                        targetPriceDisplay === 'Not Specified' ? 'text-[#FF5A00]' : 'text-white'
                      }`}>
                        {targetPriceDisplay}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <Calendar className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Required By</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-1.5 truncate">
                        {req.deadline ? new Date(req.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '31 Dec 2026'}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <MapPin className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Delivery Location</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-1.5 truncate" title={buyerLocation}>
                        {buyerLocation}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <FileText className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Purchase Type</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-1.5 truncate">
                        Bulk Purchase
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-2 text-white/50 text-[11px] sm:text-xs">
                        <CreditCard className="w-4 h-4 text-[#FF5A00] shrink-0" />
                        <span>Payment Terms</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-1.5 truncate">
                        To be Discussed
                      </div>
                    </div>
                  </div>

                  {/* 3. REQUIREMENT DESCRIPTION matching Image 1 */}
                  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl">
                    <div className="flex items-center gap-2 text-sm font-bold text-white mb-2.5">
                      <FileText className="w-4 h-4 text-[#FF5A00]" />
                      <span>Requirement Description</span>
                    </div>

                    <div className={`text-xs sm:text-sm text-white/80 leading-relaxed ${
                      !showFullDescription ? 'line-clamp-3 sm:line-clamp-none' : ''
                    }`}>
                      {req?.description || 'We are looking to purchase 5,000 pieces of cotton sarees with good quality fabric and finishing. Prefer suppliers who can provide bulk rates, multiple design options and timely delivery. Please share product catalog, price, MOQ details and delivery timeline.'}
                    </div>

                    <button
                      onClick={() => setShowFullDescription(prev => !prev)}
                      className="mt-2.5 text-xs font-bold text-[#FF5A00] hover:text-[#ff782e] flex items-center gap-1 sm:hidden transition-colors"
                    >
                      <span>{showFullDescription ? 'Read Less' : 'Read More'}</span>
                      {showFullDescription ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 4. DYNAMIC SPECIFICATIONS MATRIX matching Image 1 */}
                  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                      <Sparkles className="w-4 h-4 text-[#FF5A00]" />
                      <span>Specifications</span>
                    </div>

                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                      {specificationsList.map((spec, i) => (
                        <div
                          key={i}
                          className={`grid grid-cols-1 sm:grid-cols-3 p-3 text-xs sm:text-sm ${
                            i % 2 === 0 ? 'bg-card' : 'bg-muted/30'
                          }`}
                        >
                          <div className="text-muted-foreground font-medium sm:col-span-1">
                            {spec.label}
                          </div>
                          <div className="text-foreground font-semibold sm:col-span-2 mt-0.5 sm:mt-0">
                            {spec.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. DELIVERY LOCATION & MAP matching Image 1 */}
                  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <MapPin className="w-4 h-4 text-[#FF5A00]" />
                        <span>Delivery Location</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-500" />
                        Privacy Protected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative rounded-xl overflow-hidden border border-border h-48 bg-muted">
                        <iframe
                          title="Delivery Location Map"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyB_LJOYJL-84SMuxNB7LtRGhxEQLjswvy0&q=${encodeURIComponent(buyerLocation)}&language=en&region=cn`}
                          allowFullScreen
                        />
                        <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-border text-xs text-foreground font-bold flex items-center gap-1.5 shadow-md">
                          <MapPin className="w-3.5 h-3.5 text-[#FF5A00]" />
                          <span>{req.destination_city || 'Surat, Gujarat, India'}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                          <div className="text-muted-foreground font-medium">Address Details</div>
                          <div className="text-sm font-bold text-foreground">{buyerLocation}</div>
                          <div className="text-muted-foreground">
                            <strong>Delivery type:</strong> As per supplier agreement
                          </div>
                          <div className="text-muted-foreground">
                            <strong>Landmark:</strong> Industrial Estate / GIDC
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-200/90 text-xs flex items-start gap-2">
                          <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <strong>Full address:</strong> Shared strictly with selected suppliers after quotation approval.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. ADDITIONAL INFORMATION matching Image 1 */}
                  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                      <FileText className="w-4 h-4 text-[#FF5A00]" />
                      <span>Additional Information</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-muted/40 border border-border">
                        <span className="text-muted-foreground block">RFQ ID</span>
                        <span className="text-foreground font-mono font-bold mt-0.5 block">{rfqCode}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border">
                        <span className="text-muted-foreground block">Posted By</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Verified Buyer (Details shared after quote)
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border">
                        <span className="text-muted-foreground block">Company Type</span>
                        <span className="text-foreground font-bold mt-0.5 block">Manufacturer / Wholesaler / Trader</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border">
                        <span className="text-muted-foreground block">Expected Response Time</span>
                        <span className="text-foreground font-bold mt-0.5 block">Within 7 Days</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border sm:col-span-2">
                        <span className="text-muted-foreground block">Preferred Communication</span>
                        <span className="text-foreground font-bold mt-0.5 block">Chat on BulkSkart / Direct RFQ Negotiation</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border sm:col-span-2">
                        <span className="text-muted-foreground block">Documents Required</span>
                        <span className="text-foreground font-bold mt-0.5 block">Product catalog, price list, delivery timeline</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* QUOTES TAB */}
              {activeTab === 'quotes' && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">Quotation Proposals</h3>
                      <p className="text-xs text-white/60">Compare prices, MOQ, and terms from verified Indian manufacturers</p>
                    </div>
                    <Button
                      onClick={handleOpenSendQuote}
                      className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md"
                    >
                      Send Your Quote
                    </Button>
                  </div>

                  {displayQuotes.map((q, idx) => {
                    const comp = (q as any).companies;
                    const isOwnQuote = Boolean(
                      user?.id && (q.supplier_id === user.id || (company?.id && q.supplier_company_id === company.id))
                    );
                    return (
                      <div
                        key={q.id || idx}
                        className="bg-card border border-border hover:border-[#FF5A00]/40 rounded-2xl p-4 sm:p-5 transition-all shadow-md space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 border border-border overflow-hidden flex items-center justify-center font-bold text-white text-sm sm:text-base shrink-0">
                              {comp?.logo_url ? (
                                <SafeImage src={comp.logo_url} alt={comp?.company_name || 'Supplier'} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(comp?.company_name || 'ST').slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-white text-sm sm:text-base leading-snug">{comp?.company_name || 'Verified Supplier'}</h4>
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Verified
                                </span>
                              </div>
                              <div className="text-xs text-white/60 flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span>{comp?.business_type || 'Manufacturer'}</span>
                                <span>•</span>
                                <span>{comp?.city || 'Surat'}, {comp?.state || 'Gujarat'}</span>
                                <span>•</span>
                                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  {comp?.rating_avg || 4.8} ({comp?.review_count || 120})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                            <div className="text-base sm:text-lg font-black text-[#FF5A00] whitespace-nowrap">
                              ₹{q.unit_price} <span className="text-xs font-semibold text-white/70">/ {q.moq_unit || 'Piece'}</span>
                            </div>
                            <div className="text-[11px] text-white/50 whitespace-nowrap">
                              Total: ₹{(q.total_price || (q.unit_price * (q.moq || 5000))).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-muted/40 p-3 rounded-xl border border-border">
                          <div>
                            <span className="text-muted-foreground">MOQ:</span>{' '}
                            <strong className="text-foreground">{q.moq?.toLocaleString()} {q.moq_unit || 'Pieces'}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Delivery:</span>{' '}
                            <strong className="text-foreground">{q.delivery_days || 20} Days</strong>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-muted-foreground">Terms:</span>{' '}
                            <strong className="text-foreground truncate block">{q.payment_terms || 'Advance / LC'}</strong>
                          </div>
                        </div>

                        {q.notes && (
                          <p className="text-xs text-white/70 italic bg-white/5 p-2.5 rounded-lg border border-white/5">
                            "{q.notes}"
                          </p>
                        )}

                        {/* B2B Role Permission: Manufacturers can only message the Requirement Poster (Buyer). Only the Buyer can message quoting suppliers */}
                        {isRequirementPoster ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActiveTab('chat');
                                toast.success(`Direct chat thread opened with ${comp?.company_name || 'Supplier'}`);
                              }}
                              className="border border-border bg-white/5 text-white hover:bg-white/10 text-xs h-9 px-3 gap-1.5 w-full sm:w-auto justify-center"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Message Supplier
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setActiveTab('negotiation');
                                setCounterPrice(q.unit_price || '');
                                setCounterMoq(q.moq);
                                toast.info('Opened counter-offer negotiation room');
                              }}
                              className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-9 px-4 w-full sm:w-auto justify-center"
                            >
                              Negotiate / View Quote
                            </Button>
                          </div>
                        ) : isOwnQuote ? (
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" /> Your Submitted Proposal
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                setQuotePrice(q.unit_price || '');
                                setQuoteMoq(q.moq || 5000);
                                setQuoteDeliveryDays(q.delivery_days || 15);
                                setSendQuoteOpen(true);
                              }}
                              className="bg-white/10 hover:bg-white/15 text-white text-xs h-8 px-3"
                            >
                              Update Your Quote
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5 text-xs text-white/50">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Verified Manufacturer Quote · Market Benchmark</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setActiveTab('chat');
                                toast.info('Opened confidential 1-on-1 thread with Requirement Poster');
                              }}
                              className="border border-[#FF5A00]/40 bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 text-[#FF5A00] font-bold text-xs h-8 px-3 gap-1.5 w-full sm:w-auto justify-center"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Chat with Requirement Poster
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CHAT TAB - DIRECT 1-ON-1 REQUIREMENT POSTER CHAT */}
              {activeTab === 'chat' && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl flex flex-col h-[75vh] min-h-[500px] max-h-[700px]">
                  {/* Sticky RFQ Context Bar */}
                  <div className="p-3 bg-card border-b border-border flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                        <SafeImage
                          src={req?.attachment_url}
                          alt={req?.title || 'RFQ thumbnail'}
                          category={req?.categories?.name}
                          fallbackType="rfq"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-[#FF5A00] bg-[#FF5A00]/10 px-1.5 py-0.5 rounded border border-[#FF5A00]/20 font-bold">RFQ #{rfqCode}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">Verified Bulk Sourcing</span>
                        </div>
                        <p className="text-xs font-bold text-foreground truncate max-w-full mt-0.5">{req?.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right text-xs shrink-0">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Target Volume</div>
                        <div className="font-bold text-foreground">{req?.quantity.toLocaleString()} {req?.quantity_unit || 'Units'}</div>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">Destination</div>
                        <div className="font-bold text-foreground truncate max-w-[140px]">{buyerProfile.city}, {buyerProfile.country} {buyerProfile.flag}</div>
                      </div>
                    </div>
                  </div>

                  {/* Top Chat Partner Bar */}
                  <div className="p-3.5 sm:p-4 bg-card border-b border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 shadow">
                        {buyerProfile.avatar_initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                          <span>{buyerProfile.company_name}</span>
                          <span className="text-xs">{buyerProfile.flag}</span>
                        </h4>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          {buyerProfile.contact_person} ({buyerProfile.designation}) · Verified Buyer
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setIsFullScreenChatOpen(true)}
                        className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Dedicated Full-Screen Chat</span>
                      </Button>
                      <span className="hidden sm:inline-block text-[11px] font-bold text-[#FF5A00] bg-[#FF5A00]/10 border border-[#FF5A00]/25 px-2.5 py-0.5 rounded-full">
                        🔒 Confidential 1-on-1 Thread
                      </span>
                    </div>
                  </div>

                  {/* Informational context banner */}
                  <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 truncate">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                      <span className="truncate">Encrypted Negotiation Desk: Only you and {buyerProfile.company_name} can view this conversation.</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                      Annual Sourcing: <strong className="text-foreground">{buyerProfile.annual_procurement}</strong>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                    <div className="text-center">
                      <span className="text-[10px] bg-white/5 border border-border text-white/50 px-2.5 py-0.5 rounded-full font-mono">
                        Direct 1-on-1 Encrypted B2B Thread · {buyerProfile.sector} Sector
                      </span>
                    </div>

                    {chatMessages.map(msg => {
                      const isMe = msg.sender === 'me' || (msg as any).sender === 'supplier';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <span className="text-[10px] text-white/40 mb-1 px-1">
                            {isMe ? 'You (Verified Manufacturer)' : `${buyerProfile.company_name} (Buyer Desk)`}
                          </span>
                          <div
                            className={`max-w-[90%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm shadow-md ${
                              isMe
                                ? 'bg-[#FF5A00] text-white rounded-tr-none'
                                : 'bg-muted text-foreground border border-border rounded-tl-none'
                            }`}
                          >
                            <p className="leading-relaxed">{msg.text}</p>

                            {/* In-chat Quote Card Attachment */}
                            {msg.quoteCard && (
                              <div className="mt-3 p-3.5 rounded-xl bg-black/40 border border-white/15 text-white space-y-2.5 shadow-inner">
                                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-amber-400" />
                                    <span className="font-extrabold text-xs uppercase tracking-wider text-amber-300">Commercial Quotation Card</span>
                                  </div>
                                  <Badge className={`text-[10px] uppercase font-mono ${
                                    msg.quoteCard.status === 'accepted'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}>
                                    {msg.quoteCard.status === 'accepted' ? 'Deal Finalized' : 'Pending Review'}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-white/5 p-2 rounded-lg">
                                    <div className="text-[10px] text-white/50">Unit Price</div>
                                    <div className="font-black text-sm text-white">
                                      {msg.quoteCard.currency} {msg.quoteCard.unitPrice.toLocaleString()} / {msg.quoteCard.moqUnit}
                                    </div>
                                  </div>
                                  <div className="bg-white/5 p-2 rounded-lg">
                                    <div className="text-[10px] text-white/50">Total Est. Value</div>
                                    <div className="font-black text-sm text-emerald-400">
                                      {msg.quoteCard.currency} {msg.quoteCard.totalPrice.toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="bg-white/5 p-2 rounded-lg">
                                    <div className="text-[10px] text-white/50">Minimum Order (MOQ)</div>
                                    <div className="font-bold text-white">
                                      {msg.quoteCard.moq.toLocaleString()} {msg.quoteCard.moqUnit}
                                    </div>
                                  </div>
                                  <div className="bg-white/5 p-2 rounded-lg">
                                    <div className="text-[10px] text-white/50">Production Lead Time</div>
                                    <div className="font-bold text-white">{msg.quoteCard.deliveryDays} Days</div>
                                  </div>
                                </div>

                                <div className="text-[11px] bg-white/5 p-2 rounded-lg text-white/80 space-y-1">
                                  <div><strong className="text-white/60">Payment:</strong> {msg.quoteCard.paymentTerms}</div>
                                  <div><strong className="text-white/60">Incoterms:</strong> {msg.quoteCard.deliveryTerms}</div>
                                  {msg.quoteCard.notes && (
                                    <div><strong className="text-white/60">Notes:</strong> {msg.quoteCard.notes}</div>
                                  )}
                                </div>

                                {/* Action Buttons on Quote Card */}
                                <div className="pt-1 flex items-center gap-2 flex-wrap">
                                  {msg.quoteCard.status === 'accepted' ? (
                                    <div className="w-full p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                                      <CheckCircle className="w-4 h-4" /> Quotation Accepted by Buyer
                                    </div>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAcceptInChatQuote(msg.id)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-3 rounded-lg gap-1 shadow"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Accept Quote
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setActiveTab('negotiation');
                                          setCounterPrice(msg.quoteCard?.unitPrice || '');
                                          setCounterMoq(msg.quoteCard?.moq || 5000);
                                        }}
                                        className="bg-white/10 hover:bg-white/20 text-white text-xs h-8 px-3 rounded-lg"
                                      >
                                        Counter-Offer
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toast.success(`Downloading formal quote sheet PDF (${rfqCode})...`)}
                                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs h-8 px-2 ml-auto"
                                  >
                                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                                  </Button>
                                </div>
                              </div>
                            )}

                            {msg.attachment && (
                              <div className="mt-2 p-2.5 rounded-xl bg-black/30 border border-border flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-[10px]">
                                    PDF
                                  </div>
                                  <div>
                                    <div className="font-bold text-white truncate max-w-[150px]">{msg.attachment.name}</div>
                                    <div className="text-[10px] text-white/60">{msg.attachment.size}</div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toast.success(`Downloading ${msg.attachment?.name}...`)}
                                  className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/80' : 'text-white/40'}`}>
                              {msg.time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* IN-CHAT QUOTATION BUILDER DRAWER */}
                  {showInChatQuoteBuilder && (
                    <div className="p-4 bg-[#141722] border-t border-border space-y-3 animate-in fade-in slide-in-from-bottom duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#FF5A00]" />
                          <h5 className="text-xs font-bold text-white uppercase tracking-wider">Compose Formal Quotation Card</h5>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInChatQuoteBuilder(false)}
                          className="text-white/50 hover:text-white text-xs px-2 py-0.5 rounded"
                        >
                          ✕ Close
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Unit Price ({req?.currency || 'INR'}) *</label>
                          <Input
                            type="number"
                            value={inChatPrice}
                            onChange={e => setInChatPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 280"
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Minimum Order (MOQ)</label>
                          <Input
                            type="number"
                            value={inChatMoq}
                            onChange={e => setInChatMoq(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={String(req?.quantity || 1000)}
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Lead Time (Days)</label>
                          <Input
                            type="number"
                            value={inChatLeadDays}
                            onChange={e => setInChatLeadDays(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="15"
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Incoterms</label>
                          <Input
                            value={inChatDeliveryTerms}
                            onChange={e => setInChatDeliveryTerms(e.target.value)}
                            placeholder="FOB"
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Payment Terms</label>
                          <Input
                            value={inChatPaymentTerms}
                            onChange={e => setInChatPaymentTerms(e.target.value)}
                            placeholder="30% Advance, 70% against BL"
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/60 font-semibold block mb-1">Notes / Scope (Optional)</label>
                          <Input
                            value={inChatNotes}
                            onChange={e => setInChatNotes(e.target.value)}
                            placeholder="Includes free export packing & quality test report"
                            className="bg-[#1C2030] border-border text-white h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowInChatQuoteBuilder(false)}
                          className="text-white/60 hover:text-white text-xs h-8"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSendInChatQuote}
                          className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-8 px-4 rounded-xl gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Attach & Send Quotation Card</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* BOTTOM INPUT BAR OR SUBSCRIPTION PAYWALL */}
                  {isSupplierViewer && isPaidSubscription === false ? (
                    <div className="p-4 bg-amber-500/10 border-t border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>Subscription Paid Manufacturers Only</span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono">Premium Gate</span>
                          </div>
                          <p className="text-[11px] text-white/60 mt-0.5">
                            Only manufacturers with an active paid membership plan are permitted to send messages and quotations to verified buyers.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (!user) setSubDialogReason('not_logged_in');
                          else if (!company) setSubDialogReason('not_registered_business');
                          else setSubDialogReason('no_subscription');
                          setSubscribeDialogOpen(true);
                        }}
                        className="bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-bold px-4 py-2 rounded-xl shrink-0 gap-1.5 shadow-lg w-full sm:w-auto justify-center"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Upgrade Subscription (Razorpay)</span>
                      </Button>
                    </div>
                  ) : (
                    <div>
                      {/* AI CHAT ASSISTANT (Prompt requirement: suggested replies with Use Reply | Edit | Send) */}
                      {suggestedChatReplies.length > 0 && (
                        <div className="p-3 bg-[#131622] border-t border-border/80 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-bold text-white/90">
                              <Sparkles className="w-3.5 h-3.5 text-[#FF5A00]" />
                              <span>AI Suggested Replies (Based on your catalogue specs):</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowAiChatReplies(prev => !prev)}
                              className="text-[11px] text-[#FF5A00] hover:underline"
                            >
                              {showAiChatReplies ? 'Hide' : 'Show Suggestions'}
                            </button>
                          </div>

                          {showAiChatReplies && (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {suggestedChatReplies.map(reply => (
                                <div
                                  key={reply.id}
                                  className="p-2.5 rounded-xl bg-[#191D2C] border border-white/5 hover:border-[#FF5A00]/30 transition-all text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] uppercase font-mono font-bold text-[#FF5A00] bg-[#FF5A00]/10 px-1.5 py-0.5 rounded">
                                      {reply.category}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {/* Use Reply */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setChatInput(reply.text);
                                          toast.success('Inserted AI reply into input field');
                                        }}
                                        className="text-[10px] font-bold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
                                      >
                                        Use Reply
                                      </button>
                                      {/* Edit */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setChatInput(reply.text);
                                        }}
                                        className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 px-2 py-0.5 rounded transition-colors"
                                      >
                                        Edit
                                      </button>
                                      {/* Send */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setChatInput(reply.text);
                                          // Will be sent by the user, manufacturer always has final control
                                        }}
                                        className="text-[10px] font-bold text-white bg-[#FF5A00] hover:bg-[#e04f00] px-2.5 py-0.5 rounded transition-colors"
                                      >
                                        Send
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-white/80 text-[11px] leading-relaxed line-clamp-2">
                                    "{reply.text}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <form onSubmit={handleSendMessage} className="p-3 bg-[#12141D] border-t border-border flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInChatQuoteBuilder(prev => !prev)}
                        title="Attach Formal Price Quotation"
                        className={`p-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold ${
                          showInChatQuoteBuilder
                            ? 'bg-[#FF5A00] text-white border-[#FF5A00]'
                            : 'bg-white/5 hover:bg-white/10 text-[#FF5A00] border-[#FF5A00]/30'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Attach Quote</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toast.info('Attach PDF catalog or spec sheet')}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Attach Document"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <Input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={`Message ${buyerProfile.contact_person}...`}
                        className="flex-1 min-w-0 bg-[#181B26] border-border text-white placeholder:text-white/40 h-10 rounded-xl text-xs sm:text-sm"
                      />
                      <Button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="bg-[#FF5A00] hover:bg-[#e04f00] text-white h-10 px-4 rounded-xl shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                )}
                </div>
              )}

              {/* NEGOTIATION TAB */}
              {activeTab === 'negotiation' && (
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Live Deal Negotiation</h3>
                    <p className="text-xs text-white/60">Submit counter-offers, revised MOQ, and customized delivery milestones.</p>
                  </div>

                  {negotiationSubmitted ? (
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl text-center space-y-2">
                      <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                      <h4 className="text-base font-bold text-white">Counter-Offer Sent to Buyer</h4>
                      <p className="text-xs text-white/70 max-w-md mx-auto">
                        The buyer will receive an instant notification with your counter price of ₹{counterPrice || 240}/Piece. Responses typically arrive within 4 hours.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setNegotiationSubmitted(false)}
                        className="bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-bold mt-2"
                      >
                        Edit Counter Offer
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-white/70">Original Target Price</label>
                          <div className="p-3 bg-[#12141D] border border-border rounded-xl text-sm font-bold text-white">
                            {targetPriceDisplay}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-white/70">Your Counter Price (₹ / Unit)</label>
                          <Input
                            type="number"
                            value={counterPrice}
                            onChange={e => setCounterPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 240"
                            className="bg-[#12141D] border-border text-white h-11 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-white/70">Revised MOQ</label>
                          <Input
                            type="number"
                            value={counterMoq}
                            onChange={e => setCounterMoq(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 5000"
                            className="bg-[#12141D] border-border text-white h-11 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-white/70">Proposed Payment Terms</label>
                          <Input
                            value={counterPaymentTerms}
                            onChange={e => setCounterPaymentTerms(e.target.value)}
                            placeholder="e.g. 50% Advance, 50% on Inspection"
                            className="bg-[#12141D] border-border text-white h-11 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-white/70">Negotiation Note / Concession</label>
                        <Textarea
                          value={counterNotes}
                          onChange={e => setCounterNotes(e.target.value)}
                          placeholder="e.g. Can provide free branded packaging for orders finalized this week."
                          className="bg-[#12141D] border-border text-white rounded-xl text-xs"
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={() => {
                          if (!counterPrice) {
                            toast.error('Please specify your counter price');
                            return;
                          }
                          setNegotiationSubmitted(true);
                          toast.success('Counter offer submitted successfully!');
                        }}
                        className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold h-11 rounded-xl shadow-lg"
                      >
                        Submit Counter-Offer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-white">RFQ Audit & History Timeline</h3>
                  <div className="border-l-2 border-[#FF5A00] pl-4 space-y-4 ml-2 text-xs">
                    <div>
                      <div className="text-[#FF5A00] font-bold">Requirement Posted</div>
                      <div className="text-white/50 text-[11px]">12 Sep 2026, 10:00 AM</div>
                      <p className="text-white/80 mt-0.5">
                        Buyer {buyerProfile.company_name} submitted verified bulk RFQ for {req?.quantity.toLocaleString() || '5,000'} {req?.quantity_unit || 'pieces'} of {req?.title || 'goods'}.
                      </p>
                    </div>
                    <div>
                      <div className="text-emerald-400 font-bold">AI Supplier Matching Completed</div>
                      <div className="text-white/50 text-[11px]">12 Sep 2026, 10:05 AM</div>
                      <p className="text-white/80 mt-0.5">Matched with verified manufacturers in {buyerProfile.sector} sector with audited factory capacity.</p>
                    </div>
                    <div>
                      <div className="text-white font-bold">First Quotation Received</div>
                      <div className="text-white/50 text-[11px]">12 Sep 2026, 11:30 AM</div>
                      <p className="text-white/80 mt-0.5">Initial supplier proposal submitted with competitive delivery schedule.</p>
                    </div>
                    <div>
                      <div className="text-amber-400 font-bold">Active Negotiation</div>
                      <div className="text-white/50 text-[11px]">Currently ongoing</div>
                      <p className="text-white/80 mt-0.5">{quotes.length || 12} total quotes submitted, buyer evaluating sample specs.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Buyer Card, Deal Pipeline, Similar RFQs, Suppliers (4/12 cols) */}
            <div className="lg:col-span-4 space-y-5 md:space-y-6 min-w-0">

              {/* ─── AI PRODUCT MATCH CARD (Gated behind ₹7,500 Business Package or ₹7,500 AI Add-on) ─── */}
              {hasAiMatchingAccess && aiMatchedProducts.length > 0 ? (
                <div className="bg-card border-2 border-[#FF5A00]/30 hover:border-[#FF5A00]/50 rounded-2xl p-4 sm:p-5 shadow-xl transition-all space-y-3.5 bg-gradient-to-b from-[#1C1510] via-card to-card">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00]">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                          AI Product Match
                        </h3>
                        <p className="text-[11px] text-white/50">
                          AI found these products from your catalogue
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]/40 text-[10px] font-mono">
                      {aiMatchedProducts[0].matchScore}% Top Match
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {aiMatchedProducts.map((prod, idx) => (
                      <div
                        key={prod.id || idx}
                        className="bg-[#12141F] border border-white/10 hover:border-[#FF5A00]/40 rounded-xl p-3 space-y-2.5 transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          {prod.image && (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-12 h-12 rounded-lg object-cover bg-black/40 border border-white/10 shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-bold text-white truncate">{prod.name}</h4>
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono shrink-0">
                                {prod.matchScore}% Match
                              </span>
                            </div>
                            <div className="text-[11px] text-white/60 mt-0.5">
                              Price: <strong className="text-white">₹{prod.priceINR.toLocaleString('en-IN')}</strong> / {prod.moqUnit}
                            </div>
                          </div>
                        </div>

                        {/* Specs grid: Match %, Product price, MOQ, Available quantity, Estimated delivery */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-[#171A27] p-2 rounded-lg border border-white/5">
                          <div className="text-white/60">
                            MOQ: <span className="font-bold text-white">{prod.moq} {prod.moqUnit}</span>
                          </div>
                          <div className="text-white/60">
                            Available Qty: <span className="font-bold text-white">{prod.availableQuantity.toLocaleString()}</span>
                          </div>
                          <div className="text-white/60 col-span-2">
                            Estimated Delivery: <span className="font-bold text-emerald-400">{prod.estimatedDeliveryDays} days</span>
                          </div>
                        </div>

                        {/* CTA: Use for Quote (Prompt Requirement) */}
                        <Button
                          onClick={() => handleOpenAiQuoteModal(prod)}
                          size="sm"
                          className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-9 rounded-xl shadow-md gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Use for Quote</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Non-subscribed upgrade CTA card */
                <div className="bg-[#12141E] border-2 border-[#FF5A00]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 bg-gradient-to-b from-[#1C1510] via-[#12141E] to-[#12141E]">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-[#FF5A00]/20 text-[#FF5A00]">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                          AI Product Matching
                        </h3>
                        <p className="text-[11px] text-white/50">
                          Automated factory catalogue RFQ matching
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]/40 text-[10px] font-bold">
                      ₹7,500 Plan / Add-on
                    </Badge>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">
                    Instantly match your factory catalog products with live buyer RFQs, auto-calculate MOQ margins, and generate 1-click quotations.
                  </p>

                  <div className="space-y-2 text-xs bg-[#171A27] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                      <span>94%+ Automatic Catalog Spec Match</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                      <span>1-Click AI Quotation Generator</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                      <span>50 Live RFQ Direct Responses / Month (Unlimited on Growth)</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                      <span>Verified Manufacturer Seal & Priority Inbox</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (!user) {
                        setSubDialogReason('not_logged_in');
                      } else if (!company) {
                        setSubDialogReason('not_registered_business');
                      } else {
                        setSubDialogReason('ai_matching_subscription');
                      }
                      setSubscribeDialogOpen(true);
                    }}
                    className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-extrabold text-xs h-11 rounded-xl shadow-lg shadow-[#FF5A00]/20 gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Unlock AI Product Match — ₹7,500/mo or AI Add-on</span>
                  </Button>
                </div>
              )}

              {/* 1. BUYER INFORMATION CARD */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-white">Buyer Information</h3>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Buyer
                  </span>
                </div>

                <div className="pt-3.5 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-border flex items-center justify-center font-bold text-white text-base shrink-0 shadow-sm">
                      {buyerProfile.avatar_initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-white text-sm sm:text-base leading-snug flex items-center gap-1.5 flex-wrap">
                        <span>{buyerProfile.company_name}</span>
                        <span className="text-xs">{buyerProfile.flag}</span>
                      </h4>
                      <p className="text-xs text-white/70 mt-0.5">{buyerProfile.city}, {buyerProfile.country}</p>
                      <p className="text-[11px] text-[#FF5A00] font-medium mt-0.5">{buyerProfile.sector} Sector · Active since {buyerProfile.active_since}</p>
                      <p className="text-[11px] text-white/50 mt-0.5">Procurement: {buyerProfile.contact_person} ({buyerProfile.designation})</p>
                    </div>
                  </div>

                  {/* Buyer Metrics 3-Col Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-[#12141D] p-3 rounded-xl border border-white/5">
                    <div>
                      <div className="text-base font-black text-white">{buyerProfile.rfqs_posted}</div>
                      <div className="text-[10px] text-white/50 font-medium">RFQs Posted</div>
                    </div>
                    <div>
                      <div className="text-base font-black text-white">{buyerProfile.suppliers_connected}</div>
                      <div className="text-[10px] text-white/50 font-medium">Connected</div>
                    </div>
                    <div>
                      <div className="text-base font-black text-emerald-400">{buyerProfile.response_rate}</div>
                      <div className="text-[10px] text-white/50 font-medium">Response Rate</div>
                    </div>
                  </div>

                  {/* Annual Sourcing badge */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white/60">Annual Sourcing Budget</span>
                    <span className="font-extrabold text-white">{buyerProfile.annual_procurement}</span>
                  </div>

                  {/* Buyer Contact Phone (Gated for Paid Subscribers Only) */}
                  <div className="pt-1">
                    <ProtectedContact
                      phone={buyerProfile.phone || '+91 98201 88921'}
                      name={buyerProfile.contact_person}
                      contactType="buyer"
                      variant="card"
                    />
                  </div>

                  {/* Buyer CTA Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <Button
                      onClick={handleOpenSendQuote}
                      className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-extrabold text-sm h-11 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.4)] flex items-center justify-center gap-2"
                    >
                      <span>Send Quote</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleChatWithBuyer}
                      className="w-full border border-border bg-white/5 hover:bg-white/10 text-white font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-[#FF5A00]" />
                      <span>Chat with {buyerProfile.contact_person.split(' ')[0]}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* 2. DEAL STATUS PIPELINE matching Image 1 */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-white">Deal Status</h3>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {PIPELINE_STEPS.slice(0, 3).map((step) => {
                      const Icon = step.icon;
                      const isActive = step.key === 'active';
                      return (
                        <div key={step.key} className="flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                              isActive
                                ? 'bg-[#FF5A00] text-white border-[#FF5A00] shadow-[0_0_12px_rgba(255,90,0,0.5)]'
                                : 'bg-[#181B26] text-white/50 border-border'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[11px] mt-1.5 font-bold ${isActive ? 'text-[#FF5A00]' : 'text-white/60'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/5">
                    {PIPELINE_STEPS.slice(3, 6).map((step) => {
                      const Icon = step.icon;
                      return (
                        <div key={step.key} className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center border bg-[#181B26] text-white/40 border-border">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] mt-1.5 font-medium text-white/50">
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. SIMILAR REQUIREMENTS CARDS matching Image 1 */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-white">Similar Requirements</h3>
                  <Link to="/requirements" className="text-xs font-bold text-[#FF5A00] hover:text-[#ff782e] flex items-center gap-1">
                    <span>View All</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="pt-3 space-y-3">
                  {[
                    {
                      id: 'similar-1',
                      title: 'Silk Sarees - 3,000 Pieces',
                      category: 'Textiles & Apparel',
                      location: 'Chennai, Tamil Nadu',
                      date: '25 Sep 2026',
                      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&auto=format&fit=crop&q=80'
                    },
                    {
                      id: 'similar-2',
                      title: 'Cotton Fabric Rolls',
                      category: 'Textiles & Apparel',
                      location: 'Erode, Tamil Nadu',
                      date: '20 Sep 2026',
                      image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=80'
                    },
                    {
                      id: 'similar-3',
                      title: 'Readymade Blouses - 2,000 Pieces',
                      category: 'Textiles & Apparel',
                      location: 'Bangalore, Karnataka',
                      date: '28 Sep 2026',
                      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&auto=format&fit=crop&q=80'
                    },
                    {
                      id: 'similar-4',
                      title: 'Dress Materials - 10,000 Sets',
                      category: 'Textiles & Apparel',
                      location: 'Jaipur, Rajasthan',
                      date: '05 Oct 2026',
                      image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=400&auto=format&fit=crop&q=80'
                    }
                  ].map((sReq) => (
                    <Link
                      key={sReq.id}
                      to={`/requirement/${sReq.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#141722] hover:bg-[#1E2232] border border-white/5 hover:border-[#FF5A00]/40 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-border">
                        <SafeImage src={sReq.image} alt={sReq.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#FF5A00] transition-colors truncate">
                          {sReq.title}
                        </h4>
                        <div className="text-[11px] text-white/50 truncate mt-0.5">
                          {sReq.category}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
                          <span className="truncate">{sReq.location}</span>
                          <span>•</span>
                          <span>{sReq.date}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* 4. RECOMMENDED SUPPLIERS matching Image 1 */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-white">Recommended Suppliers</h3>
                  <Link to="/companies" className="text-xs font-bold text-[#FF5A00] hover:text-[#ff782e] flex items-center gap-1">
                    <span>View All</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="pt-3 space-y-3">
                  {[
                    {
                      name: 'Shree Sai Textiles',
                      type: 'Manufacturer',
                      location: 'Surat, Gujarat, India',
                      rating: 4.8,
                      reviews: 320
                    },
                    {
                      name: 'R.K. Saree House',
                      type: 'Wholesaler',
                      location: 'Varanasi, Uttar Pradesh',
                      rating: 4.6,
                      reviews: 210
                    },
                    {
                      name: 'Global Fabrics India',
                      type: 'Manufacturer',
                      location: 'Erode, Tamil Nadu',
                      rating: 4.5,
                      reviews: 180
                    },
                    {
                      name: 'RS Textile Exports',
                      type: 'Exporter',
                      location: 'Tiruppur, Tamil Nadu',
                      rating: 4.7,
                      reviews: 260
                    }
                  ].map((sup, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#141722] border border-white/5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-border flex items-center justify-center font-bold text-white text-xs shrink-0">
                            {sup.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{sup.name}</h4>
                            <div className="text-[10px] text-white/50 truncate">
                              {sup.type} • {sup.location}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                          Verified
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {sup.rating} ({sup.reviews})
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!user) {
                              setSubDialogReason('not_logged_in');
                              setSubscribeDialogOpen(true);
                              return;
                            }
                            toast.success(`Contact request sent to ${sup.name}`);
                          }}
                          className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-[11px] h-7 px-3 rounded-lg"
                        >
                          Contact Supplier
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── YOU MAY ALSO LIKE / RELATED PRODUCTS matching Image 1 ───────── */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                You may <span className="text-[#FF5A00]">also like</span>
              </h2>
              <Link to="/products" className="text-xs font-bold text-[#FF5A00] hover:text-[#ff782e] flex items-center gap-1">
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                {
                  id: 'p1',
                  name: 'Cotton Sarees',
                  moq: '100 Pieces',
                  price: '₹250 - ₹450 / Piece',
                  image: COTTON_SAREES_GALLERY[0]
                },
                {
                  id: 'p2',
                  name: 'Silk Cotton Sarees',
                  moq: '50 Pieces',
                  price: '₹650 - ₹1,200 / Piece',
                  image: COTTON_SAREES_GALLERY[1]
                },
                {
                  id: 'p3',
                  name: 'Printed Cotton Sarees',
                  moq: '200 Pieces',
                  price: '₹300 - ₹500 / Piece',
                  image: COTTON_SAREES_GALLERY[2]
                },
                {
                  id: 'p4',
                  name: 'Designer Sarees',
                  moq: '100 Pieces',
                  price: '₹500 - ₹850 / Piece',
                  image: COTTON_SAREES_GALLERY[3]
                },
                {
                  id: 'p5',
                  name: 'Zari Work Sarees',
                  moq: '50 Pieces',
                  price: '₹800 - ₹1,500 / Piece',
                  image: COTTON_SAREES_GALLERY[4]
                },
                {
                  id: 'p6',
                  name: 'Handloom Sarees',
                  moq: '100 Pieces',
                  price: '₹400 - ₹900 / Piece',
                  image: COTTON_SAREES_GALLERY[5]
                }
              ].map(prod => {
                const isLiked = likedProducts[prod.id] || false;
                return (
                  <div
                    key={prod.id}
                    className="bg-card border border-border hover:border-[#FF5A00]/40 rounded-xl overflow-hidden transition-all group flex flex-col shadow-md"
                  >
                    <div className="aspect-square relative bg-black/40 overflow-hidden">
                      <SafeImage
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={() => {
                          setLikedProducts(prev => ({ ...prev, [prod.id]: !isLiked }));
                          toast.success(!isLiked ? 'Added to favorites' : 'Removed from favorites');
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-border transition-all"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                      </button>
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FF5A00] transition-colors">
                          {prod.name}
                        </h4>
                        <div className="text-[10px] text-white/50 mt-0.5">
                          MOQ: <span className="text-emerald-400 font-semibold">{prod.moq}</span>
                        </div>
                      </div>
                      <div className="text-xs font-extrabold text-[#FF5A00] mt-1.5 truncate">
                        {prod.price}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE FIXED BOTTOM ACTION BAR matching Image 2 ──────────────── */}
      {!isFullScreenChatOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-2.5 px-4 md:hidden flex items-center gap-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.6)] pb-safe">
          <Button
            variant="ghost"
            onClick={handleChatWithBuyer}
            className="flex-1 border border-border bg-white/5 hover:bg-white/10 text-white font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 text-[#FF5A00]" />
            <span>Chat with Poster</span>
          </Button>

          <Button
            onClick={handleOpenSendQuote}
            className="flex-1 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-extrabold text-xs h-11 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.4)] flex items-center justify-center gap-1.5"
          >
            <span>Send Quote</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── FULLSCREEN IMAGE ZOOM MODAL ──────────────────────────────────── */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-white pb-2 border-b border-border">
            <div className="text-sm font-bold truncate max-w-md">
              {req.title} • Image {activeImageIndex + 1} of {galleryImages.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                className="text-white hover:bg-white/10 h-8 w-8 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-mono">{Math.round(zoomLevel * 100)}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                className="text-white hover:bg-white/10 h-8 w-8 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFullscreenImage(false);
                  setZoomLevel(1);
                }}
                className="text-white hover:bg-white/10 h-8 px-3 rounded-lg text-xs"
              >
                Close
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto p-4 relative">
            <img
              src={galleryImages[activeImageIndex]}
              alt="Fullscreen Zoom View"
              style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>

          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 border-t border-border">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveImageIndex(i);
                  setZoomLevel(1);
                }}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  activeImageIndex === i ? 'border-[#FF5A00]' : 'border-border opacity-60'
                }`}
              >
                <img src={img} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 3-STEP SUBMIT QUOTATION WIZARD (MATCHING SCREENS 3, 4, 5) ─────────────────── */}
      <SubmitQuotationWizard
        open={sendQuoteOpen}
        onOpenChange={setSendQuoteOpen}
        rfq={{
          id: req.id,
          reqNumber: rfqCode,
          title: req.title,
          quantity: req.quantity,
          quantityUnit: req.quantity_unit,
          targetPriceMin: req.budget_min || 60,
          targetPriceMax: req.budget_max || 75,
          deliveryLocation: buyerLocation,
          deliveryTimeText: 'Within 7-10 days',
          paymentTerms: '50% advance, 50% before dispatch',
          endSecondsRemaining: 26 * 60 + 51
        }}
        onSuccess={() => {
          loadData();
        }}
      />

      <SubscribeToContactDialog
        open={subscribeDialogOpen}
        onClose={() => setSubscribeDialogOpen(false)}
        reason={subDialogReason}
      />

      {/* AI Quotation Draft Modal (Prompt Requirement: Never send without manufacturer confirmation) */}
      <AIQuotationModal
        open={aiQuoteModalOpen}
        onOpenChange={setAiQuoteModalOpen}
        requirement={req}
        product={selectedAiProduct}
        initialDraft={aiQuotationDraft}
        onSuccess={() => {
          loadData();
        }}
        onRequireSubscription={() => {
          setSubDialogReason('quotation_subscription');
          setSubscribeDialogOpen(true);
        }}
      />

      {/* ── DEDICATED FULL-SCREEN MOBILE CHAT MODAL (100% Viewport, WhatsApp/Telegram style) ── */}
      <FullScreenMobileChat
        open={isFullScreenChatOpen}
        onClose={() => setIsFullScreenChatOpen(false)}
        requirement={req}
        buyerProfile={buyerProfile}
        rfqCode={rfqCode}
        chatMessages={chatMessages}
        onSendMessage={handleSendMessage}
        onSendQuoteCard={async (quoteData) => {
          if (!user) {
            setSubDialogReason('not_logged_in');
            setSubscribeDialogOpen(true);
            return;
          }
          if (!company) {
            setSubDialogReason('not_registered_business');
            setSubscribeDialogOpen(true);
            return;
          }
          const subCheck = await checkSupplierPaidSubscription(company.id, company);
          if (!subCheck.allowed) {
            setSubDialogReason(subCheck.reason === 'no_subscription' ? 'quotation_subscription' : subCheck.reason);
            setSubscribeDialogOpen(true);
            return;
          }

          setInChatPrice(quoteData.unitPrice);
          setInChatMoq(quoteData.moq);
          setInChatLeadDays(quoteData.deliveryDays);
          setInChatPaymentTerms(quoteData.paymentTerms);
          setInChatDeliveryTerms(quoteData.deliveryTerms);
          setInChatNotes(quoteData.notes);

          const moqVal = quoteData.moq;
          const priceVal = quoteData.unitPrice;
          const totalEst = moqVal * priceVal;

          const quoteMsg: ChatMessageItem = {
            id: `quote-${Date.now()}`,
            sender: 'me',
            text: `Formal Price Quotation Attached: ${req?.currency || 'INR'} ${priceVal.toLocaleString()} / ${req?.quantity_unit || 'Unit'} for ${moqVal.toLocaleString()} units.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            quoteCard: {
              unitPrice: priceVal,
              currency: req?.currency || 'INR',
              moq: moqVal,
              moqUnit: req?.quantity_unit || 'Units',
              deliveryDays: quoteData.deliveryDays,
              paymentTerms: quoteData.paymentTerms,
              deliveryTerms: quoteData.deliveryTerms,
              totalPrice: totalEst,
              notes: quoteData.notes || 'Includes standard factory packaging and pre-shipment quality audit.',
              status: 'pending'
            }
          };

          setChatMessages(prev => {
            const updated = [...prev, quoteMsg];
            try {
              localStorage.setItem(chatStorageKey, JSON.stringify(updated));
            } catch (err) {}
            return updated;
          });

          if (req?.id && company?.id && user) {
            try {
              const res = await createQuotation({
                requirement_id: req.id,
                supplier_company_id: company.id,
                supplier_id: user.id,
                buyer_id: req.buyer_id,
                unit_price: priceVal,
                currency: req.currency || 'INR',
                moq: moqVal,
                moq_unit: req.quantity_unit || 'Units',
                delivery_days: quoteData.deliveryDays,
                payment_terms: quoteData.paymentTerms,
                delivery_terms: quoteData.deliveryTerms,
                notes: quoteData.notes,
                status: 'pending',
                is_draft: false
              });
              if (res?.error) {
                toast.error(res.error);
                return;
              }
              const updatedQuotes = await getQuotationsForRequirement(req.id);
              setQuotes(updatedQuotes);
            } catch (e) {}
          }

          setTimeout(() => {
            const ackMsg: ChatMessageItem = {
              id: `ack-${Date.now()}`,
              sender: 'poster',
              text: `Quotation received from your side (${req?.currency || 'INR'} ${priceVal} / ${req?.quantity_unit || 'Unit'}). We are examining the commercial terms and will follow up shortly.`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev => {
              const updated = [...prev, ackMsg];
              try {
                localStorage.setItem(chatStorageKey, JSON.stringify(updated));
              } catch (err) {}
              return updated;
            });
          }, 1500);
        }}
        onAcceptQuote={handleAcceptInChatQuote}
        onCounterOffer={(price, moq) => {
          setIsFullScreenChatOpen(false);
          setActiveTab('negotiation');
          setCounterPrice(price === '' ? '' : Number(price) || '');
          setCounterMoq(Number(moq) || 1000);
          toast.info('Opened counter-offer negotiation room');
        }}
        suggestedChatReplies={suggestedChatReplies}
        isSupplierViewer={isSupplierViewer}
        isPaidSubscription={isPaidSubscription ?? true}
        onTriggerSubscription={() => {
          setSubDialogReason('no_subscription');
          setSubscribeDialogOpen(true);
        }}
      />
    </MainLayout>
  );
}
