// Gọi Edge Function của MATRAN DEPOT bằng phiên đăng nhập hiện tại (không dùng khóa bí mật ở frontend)
import { supabase } from '../../lib/supabase';

export async function callEdgeFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Chưa cấu hình database.');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Lấy đúng câu lỗi tiếng Việt Edge Function trả về
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) message = ((await ctx.json()) as { error?: string }).error || message;
    } catch {
      // giữ message gốc
    }
    throw new Error(message);
  }
  return data as T;
}
