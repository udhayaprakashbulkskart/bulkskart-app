import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';
import { syncAllPostsAndCompanies, fetchLatestImageSyncLogs } from '@/lib/pixabay';
import { RefreshCw, Camera, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Building2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SyncLogItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  pixabay_asset_id: string;
  storage_url: string;
  search_query: string;
  refresh_cycle: number;
  status: string;
  created_at: string;
}

export const AutoImageSyncManager: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [secondsUntilNext, setSecondsUntilNext] = useState(60);
  const [recentLogs, setRecentLogs] = useState<SyncLogItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalSyncedSession, setTotalSyncedSession] = useState(26);
  const isSyncingRef = useRef(false);
  const [showPrivatePanel, setShowPrivatePanel] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.search.includes('show_sync_panel=true');
    }
    return false;
  });

  // Load initial logs
  const refreshLogs = useCallback(async () => {
    const logs = await fetchLatestImageSyncLogs(10);
    if (logs.length > 0) {
      setRecentLogs(logs);
    }
  }, []);

  // 1-minute sync execution trigger
  const triggerSync = useCallback(async (manual = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const res = await syncAllPostsAndCompanies();
      if (res && res.total_photos_added > 0) {
        setTotalSyncedSession(prev => prev + res.total_photos_added);
        await refreshLogs();
        if (manual) {
          toast.success(`1-Min Sync Complete: Added ${res.total_photos_added} new photos across ${res.products_synced} products, ${res.requirements_synced} posts, and ${res.companies_synced} company profiles!`);
        }
      } else if (manual) {
        toast.info('All posts & companies already have fresh photos. Sourcing next cycle...');
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      setSecondsUntilNext(60);
    }
  }, [refreshLogs]);

  // Support secret admin key shortcut (Ctrl + Shift + P) to toggle private debug view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        setShowPrivatePanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Realtime + logs only when admin panel is open
  useEffect(() => {
    if (!showPrivatePanel) return;

    refreshLogs();

    const channel = supabase
      .channel('schema-image-sync-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'image_sync_logs' },
        (payload) => {
          const newRow = payload.new as SyncLogItem;
          setRecentLogs(prev => [newRow, ...prev.filter(i => i.id !== newRow.id)].slice(0, 10));
          setTotalSyncedSession(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshLogs, showPrivatePanel]);

  // Auto-sync ONLY when admin debug panel is open — never for every production visitor.
  // Running syncAllPostsAndCompanies() every minute for all users saturates Edge Functions
  // and makes RFQ create / dashboard queries hang.
  useEffect(() => {
    if (!showPrivatePanel) return;

    const timer = setInterval(() => {
      setSecondsUntilNext((prev) => {
        if (prev <= 1) {
          triggerSync(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [triggerSync, showPrivatePanel]);

  // Do NOT render intrusive widget for regular users
  if (!showPrivatePanel) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 max-w-[calc(100%-1.5rem)] sm:max-w-sm pointer-events-auto">
      <div className="bg-[#0a0f1d]/95 backdrop-blur-md border border-[#2A2A2A] hover:border-[#FF5A1F]/40 shadow-xl rounded-xl text-foreground overflow-hidden transition-all duration-300">
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A2A]/80 bg-[#0A0A0A]/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C94400] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C94400]"></span>
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <Camera className="w-3.5 h-3.5 text-[#FF5A1F] shrink-0" />
              <span className="text-[11px] font-semibold truncate tracking-tight text-slate-200">
                1-Min Photo Sync Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground bg-[#0A0A0A]/80 px-1.5 py-0.5 rounded border border-[#2A2A2A]/60">
              {secondsUntilNext}s
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-muted-foreground hover:text-white rounded hover:bg-[#0A0A0A] transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsed Brief Stat */}
        {!isExpanded && (
          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground bg-[#0a0f1d]/80">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3 h-3 text-[#FF5A1F] shrink-0" />
              <span className="truncate">
                Auto-adding new Pixabay photos to all posts & companies
              </span>
            </div>
            <button
              onClick={() => triggerSync(true)}
              disabled={isSyncing}
              className="shrink-0 text-[10px] font-medium text-[#FF5A1F] hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>
        )}

        {/* Expanded Panel Details */}
        {isExpanded && (
          <div className="p-3 space-y-2.5 max-h-[340px] overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] bg-[#0A0A0A]/80 p-2 rounded-lg border border-[#2A2A2A]">
              <div>
                <p className="text-muted-foreground text-[10px]">Session Refreshed Photos</p>
                <p className="text-sm font-bold text-white flex items-center gap-1">
                  <span>{totalSyncedSession}+</span>
                  <span className="text-[10px] font-normal text-[#FF7A2E]">stored in Supabase</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerSync(true)}
                disabled={isSyncing}
                className="h-7 text-[11px] gap-1 border-[#2A2A2A] hover:border-[#FF5A1F] text-slate-200"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#FF5A1F]' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
                <span>Recent 1-Min Auto Refreshes</span>
                <span className="text-[9px] lowercase font-normal">self-hosted in storage</span>
              </p>

              {recentLogs.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-muted-foreground bg-[#0A0A0A]/40 rounded border border-[#2A2A2A]/60">
                  Sync scheduled. Fetching first cycle...
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 p-1.5 rounded bg-[#0A0A0A]/60 border border-[#2A2A2A]/60 text-[11px] group"
                    >
                      <div className="w-8 h-8 rounded bg-[#0A0A0A] overflow-hidden shrink-0 border border-[#2A2A2A]">
                        <img
                          src={log.storage_url}
                          alt={log.entity_name || 'Thumbnail'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px]">
                          {log.entity_type === 'company' && <Building2 className="w-3 h-3 text-[#FF5A00] shrink-0" />}
                          {log.entity_type === 'product' && <Package className="w-3 h-3 text-[#FF5A1F] shrink-0" />}
                          {log.entity_type === 'requirement' && <Sparkles className="w-3 h-3 text-[#FF7A2E] shrink-0" />}
                          <span className="font-semibold text-slate-200 truncate">{log.entity_name || 'Post'}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground truncate">
                          {log.search_query} • {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A2E] shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoImageSyncManager;
