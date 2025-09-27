-- Fix phone storage to prevent + prefix issues
-- This updates the function to store phone as digits only (no + prefix, no dashes)
-- Run this in your Supabase SQL Editor

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_profile_info(uuid, varchar, varchar, varchar, text[]);

-- Recreate with proper phone handling
CREATE OR REPLACE FUNCTION public.update_profile_info(
  p_profile_id uuid,
  p_email VARCHAR(255),
  p_phone VARCHAR(20),
  p_secret_code VARCHAR(64),  -- Accept it but DON'T use it!
  p_proficiencies TEXT[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_digits VARCHAR(20);
BEGIN
  -- Validate that the profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Validate email format if provided
  IF p_email IS NOT NULL AND p_email != '' THEN
    IF NOT p_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
      RETURN json_build_object('success', false, 'error', 'Invalid email format');
    END IF;
  END IF;

  -- Process phone number if provided
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    -- Remove all non-digits (handles XXX-XXX-XXXX format from frontend)
    phone_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

    -- Check if it's exactly 10 digits
    IF length(phone_digits) != 10 THEN
      RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
    END IF;

    -- Phone will be stored as just digits (no formatting, no + prefix)
  ELSE
    phone_digits := NULL;
  END IF;

  -- IMPORTANT: We do NOT update secret_code here!
  -- The frontend sends the already-hashed value which would corrupt the password
  UPDATE profiles
  SET
    email = CASE
      WHEN p_email = '' THEN NULL
      ELSE p_email
    END,
    phone = CASE
      WHEN p_phone = '' THEN NULL
      ELSE phone_digits  -- Store just the 10 digits, no formatting
    END,
    -- DO NOT UPDATE secret_code! It would double-hash and corrupt it
    proficiencies = COALESCE(p_proficiencies, ARRAY[]::text[]),
    updated_at = NOW()
  WHERE id = p_profile_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update profile');
  END IF;

  -- Return success
  RETURN json_build_object('success', true, 'message', 'Profile updated successfully');

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error in update_profile_info: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_profile_info(uuid, varchar, varchar, varchar, text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.update_profile_info(uuid, varchar, varchar, varchar, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_info(uuid, varchar, varchar, varchar, text[]) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.update_profile_info IS 'Updates user profile (email, phone, skills). Ignores secret_code to prevent corruption. Stores phone as 10 digits only (no formatting, no + prefix).';

-- Verify the function was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_profile_info'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE '✅ SUCCESS: Function update_profile_info updated to store phone as digits only';
  ELSE
    RAISE EXCEPTION '❌ ERROR: Function update_profile_info was NOT created!';
  END IF;
END $$;