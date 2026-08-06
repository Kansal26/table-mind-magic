import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerRestaurantFn } from "@/lib/admin.functions";
import { registerRestaurantFn } from "@/lib/registration.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/register-restaurant")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user || !session) {
      throw redirect({ to: "/auth/login", search: { redirect: "/register-restaurant", table: "", order: "" } });
    }
    const restaurant = await getOwnerRestaurantFn({ data: { token: session.access_token } });
    if (restaurant) {
      throw redirect({ to: "/admin/dashboard" });
    }
    return { user, session };
  },
  component: RegisterRestaurantPage,
});

function RegisterRestaurantPage() {
  const { user, session } = Route.useRouteContext();
  const token = session.access_token;
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [cuisine, setCuisine] = useState("Other");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [numTables, setNumTables] = useState(5);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const registerMutation = useMutation({
    mutationFn: async () => {
      let logo_url = "";
      
      if (logoFile) {
        setIsUploading(true);
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, logoFile);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('images').getPublicUrl(filePath);
        logo_url = data.publicUrl;
        setIsUploading(false);
      }

      await registerRestaurantFn({
        data: {
          token,
          name,
          tagline,
          cuisine_type: cuisine,
          city,
          address,
          numTables,
          logo_url: logo_url || undefined
        }
      });
    },
    onSuccess: () => {
      setStep(3);
    }
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="max-w-xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Partner with TableMind</h1>
          <p className="text-muted-foreground mt-2">Get your digital restaurant up and running in minutes.</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b border-border pb-2">Step 1: Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>Restaurant Name *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Spice Garden" />
                </div>
                <div>
                  <Label>Tagline (Optional)</Label>
                  <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Authentic flavors since 1990" />
                </div>
                <div>
                  <Label>Cuisine Type</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                    value={cuisine} 
                    onChange={e => setCuisine(e.target.value)}
                  >
                    {["Indian", "Chinese", "Italian", "Continental", "Cafe", "Bakery", "Fast Food", "Other"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>City *</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai" />
                </div>
                <div>
                  <Label>Full Address *</Label>
                  <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Food Street..." />
                </div>
                <div>
                  <Label>Logo (Optional)</Label>
                  <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!name || !city || !address}>Next Step</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b border-border pb-2">Step 2: Table Setup</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>How many tables does your restaurant have?</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={numTables} 
                    onChange={e => setNumTables(Number(e.target.value))} 
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    We will automatically generate unique QR codes for each table. You can customize table names or add more tables later from your dashboard.
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button 
                  onClick={() => registerMutation.mutate()} 
                  disabled={registerMutation.isPending || isUploading}
                >
                  {registerMutation.isPending || isUploading ? "Creating..." : "Complete Registration"}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <h2 className="text-2xl font-bold">Registration Successful!</h2>
              <p className="text-muted-foreground">Your restaurant and tables have been successfully created.</p>
              
              <div className="pt-6">
                <Button size="lg" onClick={() => navigate({ to: "/admin/dashboard" })}>
                  Go to your Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
