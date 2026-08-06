import { createFileRoute } from '@tanstack/react-router'

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAdminMenuFn, upsertMenuItemFn, softDeleteMenuItemFn } from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/menu")({
  component: AdminMenuPage,
});

const ALLERGEN_OPTIONS = ["dairy", "nuts", "gluten", "soy", "eggs", "shellfish", "fish"];
const DIETARY_OPTIONS = ["vegetarian", "vegan", "non-vegetarian", "jain"];

function AdminMenuPage() {
  const queryClient = useQueryClient();
  const { user, session, restaurant } = Route.useRouteContext();
  const token = session.access_token;
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState("");
  const [badge, setBadge] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [available, setAvailable] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: menuItems = [] } = useQuery({
    queryKey: ["admin-menu", restaurant.id],
    queryFn: () => fetchAdminMenuFn({ data: { token, restaurantId: restaurant.id } }),
  });

  const categories = [...new Set(menuItems.map((i: any) => i.category))];

  const resetForm = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
    setAllergens([]);
    setDietaryTags([]);
    setPrepTime("");
    setBadge("");
    setIsFeatured(false);
    setAvailable(true);
    setSortOrder(0);
    setImageFile(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(item.price.toString());
    setCategory(item.category);
    setAllergens(item.allergens || []);
    setDietaryTags(item.dietary_tags || []);
    setPrepTime(item.prep_time_min?.toString() || "");
    setBadge(item.badge || "");
    setIsFeatured(item.is_featured || false);
    setAvailable(item.available);
    setSortOrder(item.sort_order || 0);
    setImageFile(null);
    setShowForm(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteMenuItemFn({ data: { token, itemId: id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-menu", restaurant.id] })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image_url = editingItem?.image_url || null;
      
      if (imageFile) {
        setIsUploading(true);
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, imageFile);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('images').getPublicUrl(filePath);
        image_url = data.publicUrl;
        setIsUploading(false);
      }

      await upsertMenuItemFn({
        data: {
          token,
          id: editingItem?.id,
          restaurant_id: restaurant.id,
          name,
          description: description || null,
          price: parseFloat(price),
          category,
          image_url,
          allergens,
          dietary_tags: dietaryTags,
          prep_time_min: prepTime ? parseInt(prepTime) : null,
          badge: badge || null,
          is_featured: isFeatured,
          sort_order: sortOrder,
          available
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu", restaurant.id] });
      setShowForm(false);
      resetForm();
    }
  });

  const toggleArrayItem = (arr: string[], setArr: any, item: string) => {
    if (arr.includes(item)) setArr(arr.filter(i => i !== item));
    else setArr([...arr, item]);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <Button onClick={() => {
          if (showForm) resetForm();
          setShowForm(!showForm);
        }}>
          {showForm ? "Cancel" : "Add Menu Item"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border p-6 rounded-xl mb-8">
          <h2 className="text-xl font-semibold mb-6">{editingItem ? "Edit Item" : "New Item"}</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price *</Label>
                  <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Starters" />
                </div>
              </div>
              <div>
                <Label>Image</Label>
                <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prep Time (min)</Label>
                  <Input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="mb-2 block">Allergens</Label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map(a => (
                    <span 
                      key={a}
                      onClick={() => toggleArrayItem(allergens, setAllergens, a)}
                      className={`px-3 py-1 text-sm rounded-full cursor-pointer border ${allergens.includes(a) ? "bg-red-100 border-red-200 text-red-800" : "bg-muted border-transparent"}`}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="mb-2 block">Dietary Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(d => (
                    <span 
                      key={d}
                      onClick={() => toggleArrayItem(dietaryTags, setDietaryTags, d)}
                      className={`px-3 py-1 text-sm rounded-full cursor-pointer border ${dietaryTags.includes(d) ? "bg-green-100 border-green-200 text-green-800" : "bg-muted border-transparent"}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <Label>Badge</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    value={badge}
                    onChange={e => setBadge(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="new">New</option>
                    <option value="bestseller">Bestseller</option>
                    <option value="chefs_special">Chef's Special</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Featured Item (Shows at top)</Label>
                  <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Available (In Stock)</Label>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button 
              onClick={() => saveMutation.mutate()} 
              disabled={!name || !price || !category || saveMutation.isPending || isUploading}
            >
              {saveMutation.isPending || isUploading ? "Saving..." : "Save Item"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {categories.map((cat: any) => (
          <div key={cat} className="space-y-4">
            <h3 className="text-xl font-bold border-b border-border pb-2">{cat}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {menuItems.filter((i: any) => i.category === cat).map((item: any) => (
                <div key={item.id} className={`border border-border bg-card p-4 rounded-xl flex gap-4 ${!item.available ? "opacity-60 grayscale" : ""}`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 object-cover rounded-md" />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                  
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold truncate pr-2">{item.name}</h4>
                      <span className="font-medium text-primary">${item.price}</span>
                    </div>
                    {item.badge && <span className="text-[10px] uppercase font-bold text-orange-500">{item.badge.replace("_", " ")}</span>}
                    
                    <div className="mt-auto flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleEdit(item)}>Edit</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600 flex-1" onClick={() => {
                        if (confirm(`Delete ${item.name}?`)) deleteMutation.mutate(item.id);
                      }}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {menuItems.length === 0 && !showForm && (
           <div className="py-12 text-center text-muted-foreground">
             Your menu is empty. Add some items to get started!
           </div>
        )}
      </div>
    </div>
  );
}
