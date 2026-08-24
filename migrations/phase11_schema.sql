CREATE TABLE IF NOT EXISTS loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid UNIQUE NOT NULL REFERENCES restaurants(id),
  enabled boolean DEFAULT false,

  -- Points earned per action (fully restaurant-configurable)
  points_for_rating integer DEFAULT 0,
  points_for_comment integer DEFAULT 0,
  points_for_question integer DEFAULT 0,

  -- Redemption rules
  points_per_rupee numeric DEFAULT 0,
  -- e.g. 0.5 means 1 point = ₹0.50 when redeemed
  min_order_value_to_redeem numeric DEFAULT 0,
  max_points_redeemable_per_order integer DEFAULT 0,

  -- Expiry: null = never expires; else points expire this many days after being earned
  points_expiry_days integer,

  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS points integer;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_redeemed integer DEFAULT 0;

-- Seed the existing demo restaurant with an example ENABLED config
DO $$
DECLARE
    demo_restaurant_id uuid;
BEGIN
    SELECT id INTO demo_restaurant_id FROM restaurants WHERE name = 'Olive & Ember' LIMIT 1;
    
    IF demo_restaurant_id IS NOT NULL THEN
        INSERT INTO loyalty_settings (
            restaurant_id, enabled, points_for_rating, points_for_comment, 
            points_for_question, points_per_rupee, min_order_value_to_redeem, 
            max_points_redeemable_per_order, points_expiry_days
        ) VALUES (
            demo_restaurant_id, true, 10, 20, 5, 0.5, 200, 100, 90
        ) ON CONFLICT (restaurant_id) DO UPDATE SET 
            enabled = EXCLUDED.enabled,
            points_for_rating = EXCLUDED.points_for_rating,
            points_for_comment = EXCLUDED.points_for_comment,
            points_for_question = EXCLUDED.points_for_question,
            points_per_rupee = EXCLUDED.points_per_rupee,
            min_order_value_to_redeem = EXCLUDED.min_order_value_to_redeem,
            max_points_redeemable_per_order = EXCLUDED.max_points_redeemable_per_order,
            points_expiry_days = EXCLUDED.points_expiry_days;
    END IF;
END $$;
