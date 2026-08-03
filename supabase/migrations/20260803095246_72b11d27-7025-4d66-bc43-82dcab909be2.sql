
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurants are publicly readable" ON public.restaurants FOR SELECT USING (true);

CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text,
  qr_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tables TO anon;
GRANT SELECT ON public.tables TO authenticated;
GRANT ALL ON public.tables TO service_role;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tables are publicly readable" ON public.tables FOR SELECT USING (true);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL,
  allergens text[] NOT NULL DEFAULT '{}',
  dietary_tags text[] NOT NULL DEFAULT '{}',
  available boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_restaurant_idx ON public.menu_items(restaurant_id);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menu items are publicly readable" ON public.menu_items FOR SELECT USING (true);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_table_idx ON public.sessions(table_id, status);
GRANT SELECT, INSERT, UPDATE ON public.sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions are publicly readable" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can open a session" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update a session" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'cart',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_session_idx ON public.orders(session_id, status);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders are publicly readable" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create an order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update an order" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  qty integer NOT NULL DEFAULT 1,
  customizations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items are publicly readable" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can add order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update order items" ON public.order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can remove order items" ON public.order_items FOR DELETE USING (true);

INSERT INTO public.restaurants (id, name, address) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Olive & Ember', '48 Sycamore Lane, Portland, OR');

INSERT INTO public.tables (id, restaurant_id, label, qr_token) VALUES
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Table 12', 'demo-table-12');

INSERT INTO public.menu_items (restaurant_id, name, description, price, category, allergens, dietary_tags, available, image_url) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Charred Sourdough & Whipped Butter', 'House levain, wood-fired, cultured butter and flaked sea salt.', 7.00, 'Starters', '{gluten,dairy}', '{vegetarian}', true, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Blistered Padrón Peppers', 'Olive oil, smoked paprika, lemon zest.', 9.50, 'Starters', '{}', '{vegan,gluten-free}', true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Burrata & Heirloom Tomato', 'Basil oil, aged balsamic, toasted pine nuts.', 14.00, 'Starters', '{dairy,nuts}', '{vegetarian,gluten-free}', true, 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Salt Cod Croquettes', 'Saffron aioli, preserved lemon.', 12.50, 'Starters', '{fish,gluten,egg,dairy}', '{}', true, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Little Gem Caesar', 'Cured egg yolk, anchovy, rye crumb.', 11.00, 'Starters', '{fish,egg,gluten,dairy}', '{}', true, 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Ember-Roasted Half Chicken', 'Fermented chilli butter, charred lemon, herb salad.', 27.00, 'Mains', '{dairy}', '{gluten-free}', true, 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Wild Mushroom Pappardelle', 'Hand-cut pasta, thyme cream, pecorino.', 23.00, 'Mains', '{gluten,dairy,egg}', '{vegetarian}', true, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Grilled Sea Bream', 'Fennel, blood orange, salsa verde.', 29.00, 'Mains', '{fish}', '{gluten-free,dairy-free}', true, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Smoked Aubergine Tagine', 'Chickpeas, apricot, harissa, herb couscous.', 21.00, 'Mains', '{gluten}', '{vegan}', true, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Dry-Aged Ribeye, 400g', 'Bone marrow butter, triple-cooked chips.', 46.00, 'Mains', '{dairy}', '{gluten-free}', true, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Ember Burger', 'Dry-aged beef, comté, pickled shallot, brioche.', 19.50, 'Mains', '{gluten,dairy,egg,sesame}', '{}', false, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Burnt Basque Cheesecake', 'Caramelised top, crème fraîche.', 11.00, 'Desserts', '{dairy,egg,gluten}', '{vegetarian}', true, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Olive Oil & Rosemary Cake', 'Poached pear, whipped mascarpone.', 10.00, 'Desserts', '{gluten,egg,dairy}', '{vegetarian}', true, 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Dark Chocolate Pot', '70% ganache, sea salt, olive oil.', 9.50, 'Desserts', '{dairy,soy}', '{vegetarian,gluten-free}', true, 'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?auto=format&fit=crop&w=800&q=60'),
  ('11111111-1111-4111-8111-111111111111', 'Blood Orange Sorbet', 'Citrus, mint, candied peel.', 8.00, 'Desserts', '{}', '{vegan,gluten-free,dairy-free}', true, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=800&q=60');
