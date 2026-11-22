import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://tjitsxgozkhpgzjkutrj.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_7CySlxIvxgUEazqOktrmUw_r5tQ_KvL';

export const supabase = createClient(supabaseUrl, supabaseKey);
