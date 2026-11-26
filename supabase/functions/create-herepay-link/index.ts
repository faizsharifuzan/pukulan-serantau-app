import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function myt(d: Date) {
  const m = new Date(d.getTime() + 8 * 3600 * 1000).toISOString();
  return m.slice(0, 19).replace("T", " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  // Client acting AS the user -> create_payment_order runs with the user's auth.uid()
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "Sila log masuk semula." }, 401);

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : null;
    if (!items?.length) return json({ error: "Troli kosong." }, 400);

    // Amount is computed in the database from trusted prices. Client totals are ignored.
    const { data: pay, error: payErr } = await userClient.rpc("create_payment_order", { p_items: items, p_method: "fpx" });
    if (payErr) return json({ error: payErr.message }, 400);

    const secretKey = Deno.env.get("HEREPAY_SECRET_KEY");
    const base = Deno.env.get("HEREPAY_BASE_URL") ?? "https://uat.herepay.org";
    const frontend = (Deno.env.get("FRONTEND_URL") ?? "").replace(/\/$/, "");
    if (!secretKey || !frontend.startsWith("https://")) {
      await userClient.rpc("cancel_payment_order", { p_id: pay.id });
      return json({ error: "Pembayaran FPX belum dikonfigurasi. Sila guna bank transfer." }, 503);
    }

    const total = Number(pay.total_amount);
    if (total < 1) {
      await userClient.rpc("cancel_payment_order", { p_id: pay.id });
      return json({ error: "Jumlah minimum FPX ialah RM1.00." }, 400);
    }

    const { data: prof } = await admin.from("profiles").select("full_name, phone").eq("id", u.user.id).single();
    const rows = (pay.items as Array<{ label: string; amount: number }>)
      .map((i) => `<li>${esc(String(i.label))} - RM${Number(i.amount).toFixed(2)}</li>`).join("");

    const cbUrl = `${url}/functions/v1/herepay-callback?ref=${encodeURIComponent(pay.reference_no)}&t=${pay.callback_token}`;
    const payload = {
      title: `Akademi Pukulan Serantau ${pay.reference_no}`.slice(0, 255),
      amount: Number(total.toFixed(2)),
      description: `<ul>${rows}</ul>`,
      usage_type: "single",
      expires_at: myt(new Date(Date.now() + 2 * 3600 * 1000)),
      collect_phone: true,
      callback_url: cbUrl,
      redirect_url: `${frontend}/?ref=${encodeURIComponent(pay.reference_no)}`,
      payer_name: (prof?.full_name ?? "").slice(0, 255) || undefined,
      payer_email: u.user.email,
      payer_phone: prof?.phone ? String(prof.phone).replace(/\D/g, "").replace(/^60/, "0").slice(0, 32) : undefined,
    };

    const res = await fetch(`${base}/api/integration/create-payment-link`, {
      method: "POST",
      headers: { SecretKey: secretKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.data?.pay_url) {
      console.error("herepay create link failed", res.status, JSON.stringify(out));
      await userClient.rpc("cancel_payment_order", { p_id: pay.id });
      const msg = res.status === 403 ? "Payment Link belum diaktifkan di akaun Herepay." : "Gagal menjana pautan pembayaran. Cuba lagi.";
      return json({ error: msg }, 502);
    }

    await admin.from("payments").update({
      gateway: "herepay",
      gateway_link_id: String(out.data.id ?? ""),
      gateway_bill_code: out.data.code ?? null,
      pay_url: out.data.pay_url,
    }).eq("id", pay.id);

    return json({ success: true, payment_id: pay.id, reference_no: pay.reference_no, payment_url: out.data.pay_url });
  } catch (e) {
    console.error(e);
    return json({ error: "Ralat pelayan." }, 500);
  }
});
