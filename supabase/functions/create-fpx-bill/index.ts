import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Akses tidak dibenarkan.");

    const { items, totalAmount, parentName, parentEmail, parentPhone } = await req.json();
    const refNo = `PS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const { data: payment, error: dbErr } = await supabase.from("payments").insert({
      parent_id: user.id, reference_no: refNo, payment_method: "fpx", total_amount: totalAmount, items, status: "pending",
    }).select().single();
    if (dbErr) throw dbErr;

    const BASE_URL = Deno.env.get("TOYYIBPAY_BASE_URL") || "https://dev.toyyibpay.com";
    const formData = new URLSearchParams({
      userSecretKey: Deno.env.get("TOYYIBPAY_SECRET_KEY")!,
      categoryCode: Deno.env.get("TOYYIBPAY_CATEGORY_CODE")!,
      billName: "Yuran & Kedai Pukulan Serantau",
      billDescription: `Bayaran Gabungan (${items.length} item) - ${refNo}`,
      billPriceSetting: "1",
      billPayorInfo: "1",
      billAmount: String(Math.round(totalAmount * 100)),
      billReturnUrl: `${Deno.env.get("FRONTEND_URL")}/?ref=${refNo}`,
      billCallbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/fpx-callback`,
      billExternalReferenceNo: refNo,
      billTo: parentName,
      billEmail: parentEmail,
      billPhone: parentPhone,
      billPaymentChannel: "0",
    });

    const response = await fetch(`${BASE_URL}/index.php/api/createBill`, { method: "POST", body: formData });
    const result = await response.json();
    if (!result[0]?.BillCode) throw new Error("Gagal menjana bil FPX.");

    await supabase.from("payments").update({ gateway_bill_code: result[0].BillCode }).eq("id", payment.id);
    return new Response(JSON.stringify({ success: true, reference_no: refNo, payment_url: `${BASE_URL}/${result[0].BillCode}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
