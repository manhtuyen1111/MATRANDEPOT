// Cấu hình môi trường dùng chung — tách khỏi supabase.ts để không kéo supabase-js vào bundle khi chỉ cần kiểm tra chế độ
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Chưa cấu hình Supabase → chạy chế độ Local/Demo (DEC-010)
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-public-anon-key')
);
