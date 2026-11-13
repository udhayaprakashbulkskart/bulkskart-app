import React, { useEffect, useRef, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Send, Paperclip, Search, MoreVertical, ShieldCheck, FileText, Image, RefreshCw, ChevronLeft, Download, Building2 } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageMeta from '@/components/common/PageMeta';
import { exportChatTranscript } from '@/utils/exportChatTranscript';

type MsgType = {
  id: string; conversation_id: string; sender_id: string; content: string;
  attachment_url: string | null; attachment_name: string | null; attachment_type: string | null;
  is_file: boolean; is_read: boolean; created_at: string;
  sender?: { full_name: string | null; avatar_url: string | null };
};

type ConvType = {
  id: string; requirement_id: string | null; quotation_id: string | null; order_id: string | null;
  buyer_id: string; supplier_id: string; supplier_company_id: string;
  last_message: string | null; buyer_unread: number; supplier_unread: number;
  buyer_blocked: boolean; supplier_blocked: boolean;
  buyer?: { full_name: string | null };
  companies?: { company_name: string; is_verified: boolean; slug: string };
};

const toHex = (s: string) =>
  Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

const FILE_ICONS: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="w-4 h-4 text-[#FF7A2E]" />,
  'image/': <Image className="w-4 h-4 text-[#FF5A00]" />,
};

function fileIcon(type: string | null) {
  if (!type) return <Paperclip className="w-4 h-4 text-muted-foreground" />;
  for (const [k, v] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(k)) return v;
  }
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

export default function NegotiationRoomPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [conv, setConv] = useState<ConvType | null>(null);
  const [messages, setMessages] = useState<MsgType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isBlocked = conv ? (profile?.role === 'buyer' ? conv.buyer_blocked : conv.supplier_blocked) : false;
  const iAmBuyer = user?.id === conv?.buyer_id;

  const fetchConv = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from('conversations')
      .select('*, buyer:buyer_id(full_name), companies:supplier_company_id(company_name, is_verified, slug)')
      .eq('id', conversationId)
      .maybeSingle();
    if (data) setConv(data as ConvType);
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages(Array.isArray(data) ? data as MsgType[] : []);
    setLoading(false);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Mark as read
    if (user && data?.length) {
      const unread = data.filter(m => m.sender_id !== user.id && !m.is_read).map(m => m.id);
      if (unread.length) {
        await supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unread);
      }
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchConv();
    fetchMessages();
    // Realtime subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const chName = `negotiation-${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      channel = supabase
        .channel(chName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          () => fetchMessages()
        )
        .subscribe();
    } catch (e) {
      console.warn('NegotiationRoom realtime subscription skipped:', e);
    }
    return () => { 
      if (channel) supabase.removeChannel(channel); 
    };
  }, [conversationId, fetchConv, fetchMessages]);

  const sendMessage = async (content: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!conversationId || !user) return;
    setSending(true);
    const payload = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || (fileName ? `Sent a file: ${fileName}` : ''),
      attachment_url: fileUrl || null,
      attachment_name: fileName || null,
      attachment_type: fileType || null,
      is_file: !!fileUrl,
    };
    const { error } = await supabase.from('messages').insert(payload);
    if (error) { toast.error('Failed to send message'); }
    else {
      await supabase.from('conversations').update({
        last_message: payload.content,
        last_message_at: new Date().toISOString(),
        ...(iAmBuyer ? { supplier_unread: (conv?.supplier_unread || 0) + 1 } : { buyer_unread: (conv?.buyer_unread || 0) + 1 }),
      }).eq('id', conversationId);
      setText('');
    }
    setSending(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) { toast.error('Max file size is 10MB'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Unsupported file type'); return; }

    setUploadingFile(true);
    const dot = file.name.lastIndexOf('.');
    const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
    const ext = dot > 0 ? file.name.slice(dot) : '';
    const safeName = `${user!.id}/${conversationId}/${Date.now()}-${toHex(stem)}${ext}`;
    const { data, error } = await supabase.storage.from('chat-files').upload(safeName, file, { upsert: false });
    if (error) { toast.error('File upload failed'); setUploadingFile(false); return; }
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path);
    await sendMessage('', urlData.publicUrl, file.name, file.type);
    setUploadingFile(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleBlock = async () => {
    if (!conv) return;
    const field = iAmBuyer ? 'buyer_blocked' : 'supplier_blocked';
    await supabase.from('conversations').update({ [field]: true }).eq('id', conv.id);
    toast.success('User blocked. They can no longer message you in this thread.');
    fetchConv();
  };

  const handleExportTranscript = () => {
    if (!conv || messages.length === 0) {
      toast.info('No messages to export yet');
      return;
    }
    const buyerName = (conv.buyer as { full_name?: string | null } | undefined)?.full_name || 'Buyer';
    const supplierName = conv.companies?.company_name || 'Manufacturer';
    exportChatTranscript({
      conversationId: conv.id,
      participant1: { name: buyerName, role: 'Buyer' },
      participant2: { name: supplierName, role: 'Manufacturer', company: conv.companies?.company_name },
      topic: conv.requirement_id ? `RFQ Negotiation #${conv.requirement_id.slice(0, 8)}` : conv.order_id ? `Order #${conv.order_id.slice(0, 8)}` : 'Trade Negotiation',
      messages: messages.map(m => ({
        id: m.id,
        senderName: m.sender?.full_name || (m.sender_id === user?.id ? (profile?.full_name || 'You') : otherName),
        role: m.sender_id === conv.buyer_id ? 'Buyer' : 'Manufacturer',
        content: m.content,
        createdAt: m.created_at,
        attachmentName: m.attachment_name,
        attachmentUrl: m.attachment_url,
      })),
    });
    toast.success('Negotiation transcript exported');
  };

  const filteredMessages = search
    ? messages.filter(m => m.content.toLowerCase().includes(search.toLowerCase()) || m.attachment_name?.toLowerCase().includes(search.toLowerCase()))
    : messages;

  const otherName = iAmBuyer
    ? (conv?.companies?.company_name || 'Manufacturer')
    : ((conv?.buyer as { full_name?: string | null } | undefined)?.full_name || 'Buyer');

  if (loading) return (
    <DashboardLayout>
      <PageMeta
        title="Negotiation Room | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{otherName}</span>
              {conv?.companies?.is_verified && (
                <Badge className="bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 text-[10px] px-1.5 py-0 gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {conv?.requirement_id ? 'RFQ Negotiation' : conv?.order_id ? 'Order Chat' : 'Direct Message'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTranscript}
              className="h-8 gap-1.5 text-xs border-border"
              title="Export negotiation transcript"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(v => !v)}>
              <Search className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportTranscript} className="gap-2">
                  <Download className="w-4 h-4" /> Export Transcript
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBlock} className="text-[#FF7A2E]">Block User</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const reportPath = profile?.role === 'buyer' ? '/dashboard/buyer/disputes' : '/dashboard/supplier/disputes';
                  navigate(reportPath);
                }}>Report / Raise Dispute</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-border bg-muted/50 shrink-0">
            <Input
              placeholder="Search messages…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          {filteredMessages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-10">
              {search ? 'No messages match your search.' : 'Start the conversation!'}
            </p>
          )}
          {filteredMessages.map(msg => {
            const isMine = msg.sender_id === user?.id;
            const isUrgent = /(?:^|\b)(?:urgent|asap|emergency|rush|immediate|priority)(?:\b|$)/i.test(msg.content || '');
            const senderCompany = conv?.companies?.company_name;
            const senderPerson = (msg.sender as { full_name?: string | null } | undefined)?.full_name;
            const displayName = !isMine ? (senderCompany || senderPerson || 'Partner') : 'You';

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-bold text-foreground/80 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-primary" />
                      {displayName}
                    </span>
                    {isUrgent && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-[#B33D00] text-white animate-pulse">
                        🚨 URGENT
                      </span>
                    )}
                  </div>
                )}
                <div className={`max-w-[78%] rounded-xl px-3.5 py-2.5 shadow-xs ${
                  isMine
                    ? 'bg-[#C94400] text-primary-foreground'
                    : isUrgent
                    ? 'bg-card border-2 border-[#FF5A00]/80 text-foreground ring-2 ring-[#FF5A00]/20'
                    : 'bg-muted text-foreground'
                }`}>
                  {msg.is_file && msg.attachment_url ? (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-2 text-sm underline underline-offset-2 ${isMine ? 'text-primary-foreground' : 'text-primary'}`}
                    >
                      {fileIcon(msg.attachment_type)}
                      <span className="truncate max-w-[180px]">{msg.attachment_name || 'File'}</span>
                    </a>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  )}
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    <span className="text-[10px]">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMine && msg.is_read && <span className="text-[10px]">✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {isBlocked ? (
          <div className="px-4 py-3 border-t border-border bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">This conversation has been blocked.</p>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploadingFile}>
                {uploadingFile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.pdf,.xls,.xlsx,.doc,.docx" onChange={handleFile} />
              <Input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); sendMessage(text.trim()); } }}
              />
              <Button
                onClick={() => text.trim() && sendMessage(text.trim())}
                disabled={sending || !text.trim()}
                className="bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
