# Kelab Silat Olahraga Pukulan Serantau (PSSPS) — Production App

## Cara Deploy ke Cloudflare Pages (Melalui GitHub)
1. Ekstrak fail `.zip` ini dan muat naik semua fail ke repository GitHub `pukulan-serantau-app`.
2. Buka **Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git**.
3. Pilih repository `pukulan-serantau-app`.
4. Tetapkan Build Settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Masukkan Environment Variables:
   - `VITE_SUPABASE_URL` = `https://tjitsxgozkhpgzjkutrj.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_7CySlxIvxgUEazqOktrmUw_r5tQ_KvL`
6. Klik **Save and Deploy**.

## Jadikan Akaun Anda Sebagai Master Admin
1. Daftar akaun anda sendiri di aplikasi yang sudah live.
2. Buka **Supabase Dashboard -> Table Editor -> profiles**.
3. Tukar lajur `role` bagi akaun anda daripada `parent` kepada `admin`.
4. Muat semula aplikasi — anda kini mempunyai akses penuh Admin & boleh klik **Seed 44 Pesilat Asal**!
