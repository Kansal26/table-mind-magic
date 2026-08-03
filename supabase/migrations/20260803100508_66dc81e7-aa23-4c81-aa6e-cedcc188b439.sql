-- 1. Session secret used to prove ownership of a dining session
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS sessions_access_token_key ON public.sessions (access_token);

-- 2. Drop permissive anonymous policies
DROP POLICY IF EXISTS "Anyone can open a session" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can update a session" ON public.sessions;
DROP POLICY IF EXISTS "Sessions are publicly readable" ON public.sessions;

DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update an order" ON public.orders;
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;

DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can remove order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items are publicly readable" ON public.order_items;

-- 3. Revoke Data API access for anonymous/authenticated clients; server-only from now on
REVOKE ALL ON public.sessions FROM anon, authenticated;
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.order_items FROM anon, authenticated;

GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4. Public catalogue data stays readable by anonymous QR diners
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT SELECT ON public.tables TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;