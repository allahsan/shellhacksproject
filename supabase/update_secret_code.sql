-- Function to update user's secret code
CREATE OR REPLACE FUNCTION update_secret_code(
  p_profile_id UUID,
  p_current_code TEXT,
  p_new_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the current secret code matches (compare hashed versions)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id
    AND secret_code = encode(digest(p_current_code, 'sha256'), 'hex')
  ) THEN
    RAISE EXCEPTION 'Current secret code is incorrect';
  END IF;

  -- Update the secret code (store as hashed)
  UPDATE profiles
  SET secret_code = encode(digest(p_new_code, 'sha256'), 'hex')
  WHERE id = p_profile_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_secret_code TO authenticated;
GRANT EXECUTE ON FUNCTION update_secret_code TO anon;