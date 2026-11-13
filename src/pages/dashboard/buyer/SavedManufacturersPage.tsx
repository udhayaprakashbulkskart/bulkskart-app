import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Heart, Building2, ShieldCheck, RefreshCw, Star, MapPin, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';

type SavedMfr = {
  id: string; company_id: string; created_at: string;
  companies?: {
    id: string; company_name: string; slug: string; is_verified: boolean;
    city: string | null; country: string; business_type: string | null;
    logo_url: string | null; profile_completion: number;
    rating_avg: number; review_count: number;
    key_products: string[] | null;
  };
};

export default function SavedManufacturersPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedMfr[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('saved_manufacturers')
      .select('*, companies(id, company_name, slug, is_verified, city, country, business_type, logo_url, profile_completion, rating_avg, review_count, key_products)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setSaved(Array.isArray(data) ? data as SavedMfr[] : []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user]);

  const unfollow = async (id: string) => {
    await supabase.from('saved_manufacturers').delete().eq('id', id);
    setSaved(prev => prev.filter(s => s.id !== id));
    toast.success('Manufacturer unfollowed');
  };

  if (loading) return (
    <DashboardLayout>
      <PageMeta
        title="Saved Manufacturers — Buyer | BulkSkart"
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
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Saved Manufacturers</h1>
            <p className="text-sm text-muted-foreground">{saved.length} manufacturer{saved.length !== 1 ? 's' : ''} saved</p>
          </div>
        </div>

        {saved.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="font-semibold text-foreground mb-1">No saved manufacturers yet</h3>
              <p className="text-sm">Browse manufacturers and save the ones you want to follow.</p>
              <Button asChild className="mt-4 bg-[#1A0C05] hover:bg-primary/90 text-primary-foreground">
                <Link to="/manufacturers">Browse Manufacturers</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {saved.map(s => {
              const c = s.companies;
              if (!c) return null;
              return (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.company_name)}&background=1e293b&color=ff5a00&bold=true`}
                            alt={c.company_name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.company_name)}&background=1e293b&color=ff5a00&bold=true`;
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/companies/${c.slug}`} className="font-semibold text-sm text-foreground hover:text-primary truncate">
                            {c.company_name}
                          </Link>
                          {c.is_verified && (
                            <Badge className="bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40 text-[10px] px-1.5 py-0 gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {c.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}, {c.country}</span>}
                          {c.business_type && <span>{c.business_type}</span>}
                          {c.review_count > 0 && (
                            <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-[#FF5A00] text-[#FF7A2E]" />{Number(c.rating_avg).toFixed(1)} ({c.review_count})</span>
                          )}
                        </div>
                        {c.key_products?.length ? (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{c.key_products.slice(0, 3).join(', ')}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => unfollow(s.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to={`/companies/${c.slug}`}><ExternalLink className="w-3.5 h-3.5 mr-1" />View Profile</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
