-- The requirement detail page calls rpc('increment_requirement_view_count', { req_id }).
-- The function was missing in production, so every view returned HTTP 404.
-- Adds an atomic increment of requirements.view_count. Safe to re-run.

CREATE OR REPLACE FUNCTION public.increment_requirement_view_count(req_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.requirements
     SET view_count = COALESCE(view_count, 0) + 1
   WHERE id = req_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_requirement_view_count(uuid) TO anon, authenticated;
