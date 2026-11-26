import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const u = new URL(req.url);
    const ref = u.searchParams.get("ref") ?? "";
    const token = u.searchParams.get("t") ?? "";
    const privateKey = Deno.env.get("HEREPAY_PRIVATE_KEY");
    if (!ref || !token || !privateKey) return new Response("Bad request", { status: 400 });

    const form = await req.formData();
    const fields: Record<string, string> = {};
    for (const [k, v] of form.entries()) fields[k] = String(v);
    const given = (fields.checksum ?? "").toLowerCase();
    delete fields.checksum;

    // Checksum: all fields except checksum, sorted A-Z by name, values joined by commas, HMAC-SHA256 with Private Key
    const signed = Object.keys(fields).sort().map((k) => fields[k]).join(",");
    const expected = await hmacHex(privateKey, signed);
    if (!given || !safeEqual(expected, given)) {
      console.warn("herepay callback: bad checksum for", ref);
      return new Response("Invalid checksum", { status: 401 });
    }

    const code = fields.status_code;
    const result = code === "00" ? "success" : code === "30" ? "failed" : "pending";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("apply_gateway_result", {
      p_ref: ref,
      p_token: token,
      p_amount: Number(fields.amount),
      p_result: result,
      p_payment_code: fields.payment_code ?? "",
      p_txn: fields.transaction_id ?? "",
      p_payload: fields,
    });
    if (error) {
      console.error("apply_gateway_result", error.message);
      return new Response("Server error", { status: 500 });
    }
    console.log("herepay callback", ref, result, data);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
});
