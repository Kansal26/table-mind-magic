CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  -- 'change_password' | 'delete_account' | 'deactivate_account' | 'reactivate_account'
  code_hash text NOT NULL,
  salt text NOT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 5,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on otp_verifications (optional if only accessed via server functions, but good practice)
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Allow only service role to manage OTPs natively, everything else happens through RPC/Server Functions
CREATE POLICY "Service role manages OTPs" 
ON otp_verifications FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Add deactivated_at column to restaurants for Account Deactivation feature
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- True atomic Postgres transaction for cascade deleting a restaurant owner's entire account footprint
-- This ensures no orphaned rows are left if the connection drops halfway through.
CREATE OR REPLACE FUNCTION delete_restaurant_account(owner_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the definer (postgres/admin) to bypass RLS and do full deletion
AS $$
DECLARE
    r_id uuid;
    s_id uuid;
    t_id uuid;
    o_id uuid;
BEGIN
    -- Explicitly verify ownership to ensure no-op on bogus IDs
    IF NOT EXISTS (SELECT 1 FROM restaurants WHERE owner_id = owner_id_param) THEN
        RETURN;
    END IF;

    -- For each restaurant owned by this user
    FOR r_id IN SELECT id FROM restaurants WHERE owner_id = owner_id_param LOOP
        
        -- For each table in the restaurant
        FOR t_id IN SELECT id FROM tables WHERE restaurant_id = r_id LOOP
            -- For each session on the table
            FOR s_id IN SELECT id FROM sessions WHERE table_id = t_id LOOP
                -- Delete session dependencies
                DELETE FROM session_participants WHERE session_id = s_id;
                DELETE FROM recommendation_logs WHERE session_id = s_id;
                DELETE FROM waiter_calls WHERE session_id = s_id;
                
                -- For each order in the session
                FOR o_id IN SELECT id FROM orders WHERE session_id = s_id LOOP
                    DELETE FROM feedback WHERE order_id = o_id;
                    DELETE FROM order_discounts WHERE order_id = o_id;
                    DELETE FROM order_items WHERE order_id = o_id;
                    -- wallet_transactions can reference orders too
                    DELETE FROM wallet_transactions WHERE order_id = o_id;
                END LOOP;
                -- Delete orders themselves
                DELETE FROM orders WHERE session_id = s_id;
            END LOOP;
            -- Delete sessions themselves
            DELETE FROM sessions WHERE table_id = t_id;
        END LOOP;
        
        -- Delete tables themselves
        DELETE FROM tables WHERE restaurant_id = r_id;
        
        -- NOW that order_items are deleted, we can safely delete menu_items
        DELETE FROM menu_items WHERE restaurant_id = r_id;

        -- Delete remaining direct dependencies
        DELETE FROM wallet_transactions WHERE restaurant_id = r_id;
        DELETE FROM loyalty_settings WHERE restaurant_id = r_id;
        DELETE FROM coupons WHERE restaurant_id = r_id;
        
    END LOOP;

    -- Delete all OTPs for the user
    DELETE FROM otp_verifications WHERE user_id = owner_id_param;

    -- Delete the restaurant itself
    DELETE FROM restaurants WHERE owner_id = owner_id_param;

    -- Clean up any remaining direct user references that might block auth.users deletion
    DELETE FROM wallet_transactions WHERE user_id = owner_id_param;
    DELETE FROM wallets WHERE user_id = owner_id_param;
    DELETE FROM profiles WHERE id = owner_id_param;
    
    -- (Note: The actual auth.users deletion will be handled securely via the Supabase Admin API in the server function)
END;
$$;
