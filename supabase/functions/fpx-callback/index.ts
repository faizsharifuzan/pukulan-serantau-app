import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const formData = await req.formData();
    const refNo = formData.get("order_id")?.toString();
    const statusId = formData.get("status_id")?.toString();
    const billCode = formData.get("billcode")?.toString();
    const transactionId = formData.get("transaction_id")?.toString();
    if (!refNo || !billCode) return new Response("Missing parameters", { status: 400 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const newStatus = statusId === "1" ? "paid" : statusId === "3" ? "failed" : "pending";
    await supabase.from("payments").update({
      status: newStatus, gateway_transaction_id: transactionId, paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    }).eq("reference_no", refNo).eq("gateway_bill_code", billCode);

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});
