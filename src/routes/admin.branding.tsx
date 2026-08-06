import { createFileRoute } from '@tanstack/react-router'

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateBrandingFn } from "@/lib/branding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/branding")({
  component: AdminBrandingPage,
});

function AdminBrandingPage() {
  const queryClient = useQueryClient();
  // `restaurant` is already fetched in the layout beforeLoad
  const { user, restaurant } = Route.useRouteContext();
  
  const [tagline, setTagline] = useState(restaurant.tagline || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      let logo_url = restaurant.logo_url;
      let banner_url = restaurant.banner_url;

      try {
        if (logoFile) {
          const fileExt = logoFile.name.split('.').pop();
          const fileName = `logo_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('images').upload(filePath, logoFile);
          if (uploadError) throw uploadError;
          
          const { data } = supabase.storage.from('images').getPublicUrl(filePath);
          logo_url = data.publicUrl;
        }

        if (bannerFile) {
          const fileExt = bannerFile.name.split('.').pop();
          const fileName = `banner_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('images').upload(filePath, bannerFile);
          if (uploadError) throw uploadError;
          
          const { data } = supabase.storage.from('images').getPublicUrl(filePath);
          banner_url = data.publicUrl;
        }

        await updateBrandingFn({
          data: {
            restaurantId: restaurant.id,
            tagline,
            logo_url,
            banner_url
          }
        });

      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      // Force reload to get the new restaurant data into the router context, 
      // or invalidate queries. For simplicity, just reload since layout fetches on mount.
      window.location.reload();
    }
  });

  const removeBannerMutation = useMutation({
    mutationFn: () => updateBrandingFn({ data: { restaurantId: restaurant.id, banner_url: null } }),
    onSuccess: () => window.location.reload()
  });

  return (
    <div className="p-6 max-w-4xl mx-auto grid md:grid-cols-2 gap-12">
      <div>
        <h1 className="text-2xl font-bold mb-6">Brand Settings</h1>
        
        <div className="space-y-6">
          <div>
            <Label>Tagline</Label>
            <Input 
              value={tagline} 
              onChange={e => setTagline(e.target.value)} 
              placeholder="e.g. Authentic flavors since 1990" 
            />
          </div>
          
          <div>
            <Label>Logo</Label>
            {restaurant.logo_url && !logoFile && (
              <div className="mb-2">
                <img src={restaurant.logo_url} alt="Logo" className="h-16 w-16 object-cover rounded-md border border-border" />
              </div>
            )}
            <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
          </div>

          <div>
            <Label>Promotional Banner</Label>
            {restaurant.banner_url && !bannerFile && (
              <div className="mb-2 space-y-2">
                <img src={restaurant.banner_url} alt="Banner" className="w-full h-32 object-cover rounded-md border border-border" />
                <Button variant="outline" size="sm" onClick={() => removeBannerMutation.mutate()}>
                  Remove Banner
                </Button>
              </div>
            )}
            <Input type="file" accept="image/*" onChange={e => setBannerFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground mt-1">Recommended size: 1200x400px. Appears at the top of the customer menu.</p>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isUploading}
          >
            {saveMutation.isPending || isUploading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      
      {/* PREVIEW */}
      <div className="bg-muted rounded-3xl p-4 border border-border shadow-inner">
        <div className="text-sm font-semibold text-center mb-4 text-muted-foreground">Menu Preview</div>
        <div className="bg-background rounded-2xl overflow-hidden shadow-sm border border-border pb-12">
          {/* Banner Preview */}
          {(bannerFile || restaurant.banner_url) && (
            <div className="h-24 bg-gray-200">
              <img 
                src={bannerFile ? URL.createObjectURL(bannerFile) : restaurant.banner_url} 
                className="w-full h-full object-cover" 
                alt="Banner preview" 
              />
            </div>
          )}
          
          <div className="p-4 text-center">
            {/* Logo Preview */}
            {(logoFile || restaurant.logo_url) && (
              <img 
                src={logoFile ? URL.createObjectURL(logoFile) : restaurant.logo_url} 
                className={`w-14 h-14 object-cover rounded-full mx-auto shadow-sm border border-border ${
                  (bannerFile || restaurant.banner_url) ? "-mt-10 mb-2" : "mb-4"
                }`}
                alt="Logo preview" 
              />
            )}
            
            <h2 className="font-display font-bold text-lg">{restaurant.name}</h2>
            {(tagline || restaurant.tagline) && (
              <p className="text-xs text-muted-foreground mt-1">{tagline || restaurant.tagline}</p>
            )}
          </div>
          
          <div className="px-4 space-y-3">
            <div className="h-16 bg-muted rounded-xl animate-pulse"></div>
            <div className="h-16 bg-muted rounded-xl animate-pulse"></div>
            <div className="h-16 bg-muted rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
