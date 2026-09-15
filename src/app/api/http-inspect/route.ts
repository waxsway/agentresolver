import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { logPaidCapabilityAttempt } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_PRICING } from "@/lib/x402Config";

export const dynamic = "force-dynamic";
const MAX_URL = 500;
const TIMEOUT_MS = 4500;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;
let paidHandler: PaidHandler | null = null;

function blocked(ip: string) {
  if (isIP(ip) === 4) { const p=ip.split('.').map(Number); const [a,b]=p; return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a>=224; }
  const v=ip.toLowerCase(); return v==='::'||v==='::1'||v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe8')||v.startsWith('fe9')||v.startsWith('fea')||v.startsWith('feb');
}
async function safeUrl(input: string) {
  const url=new URL(input); if(url.protocol!=="https:") throw new Error("Only public HTTPS URLs are supported.");
  if(url.username||url.password||url.port) throw new Error("Credentials and custom ports are not supported.");
  const host=url.hostname.toLowerCase(); if(host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')) throw new Error("Private hosts are not supported.");
  const ips=isIP(host)?[{address:host}]:await lookup(host,{all:true,verbatim:true}); if(!ips.length||ips.some(x=>blocked(x.address))) throw new Error("Private or reserved targets are not supported.");
  return url;
}
async function inspectHandler(req: NextRequest): Promise<NextResponse<unknown>> {
  const body=(await req.json().catch(()=>null)) as {url?:unknown}|null; const raw=String(body?.url||"").trim();
  if(!raw) return NextResponse.json({error:"MISSING_URL",message:"Provide a public HTTPS URL."},{status:400});
  if(raw.length>MAX_URL) return NextResponse.json({error:"URL_TOO_LONG",message:"URL must be 500 characters or fewer."},{status:400});
  try {
    const url=await safeUrl(raw); const started=Date.now(); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    const response=await fetch(url,{method:"HEAD",redirect:"manual",signal:controller.signal,headers:{"user-agent":"AgentResolver-HTTP-Inspect/0.1","accept":"*/*"}}).finally(()=>clearTimeout(timer));
    const report={url:url.toString(),status:response.status,ok:response.ok,latencyMs:Date.now()-started,contentType:response.headers.get("content-type"),contentLength:response.headers.get("content-length"),cacheControl:response.headers.get("cache-control"),etag:response.headers.get("etag"),lastModified:response.headers.get("last-modified"),location:response.headers.get("location"),server:response.headers.get("server"),security:{hsts:Boolean(response.headers.get("strict-transport-security")),csp:Boolean(response.headers.get("content-security-policy")),xContentTypeOptions:Boolean(response.headers.get("x-content-type-options"))}};
    console.log(JSON.stringify({event:"paid_capability_completed",capabilityId:"http-inspect",at:new Date().toISOString(),status:report.status,latencyMs:report.latencyMs}));
    return NextResponse.json(report,{headers:{"cache-control":"no-store","access-control-allow-origin":"*"}});
  } catch(error) { return NextResponse.json({error:"INSPECTION_FAILED",message:error instanceof Error?error.message:"Inspection failed."},{status:400}); }
}
function getPaidHandler(): PaidHandler {
  if(paidHandler) return paidHandler; const payTo=(process.env.AGENTRESOLVER_PAY_TO||X402_PAY_TO).trim(); const facilitatorUrl=(process.env.X402_FACILITATOR_URL||X402_FACILITATOR_URL).trim();
  const client=new HTTPFacilitatorClient({url:facilitatorUrl,timeoutMs:10000}); const server=new x402ResourceServer(client).register(X402_NETWORK,new ExactEvmScheme());
  paidHandler=withX402<unknown>(inspectHandler,{"/api/http-inspect":{accepts:{scheme:"exact",price:X402_PRICING.httpInspect,network:X402_NETWORK,payTo:payTo as `0x${string}`},description:"Inspect a public HTTPS resource for current status, latency, response metadata, cache validators and baseline security headers.",mimeType:"application/json"}},server) as PaidHandler; return paidHandler;
}
async function paidRequest(req:NextRequest){logPaidCapabilityAttempt(req,"http-inspect");try{return await getPaidHandler()(req);}catch(error){console.error(JSON.stringify({event:"paid_capability_configuration_error",capabilityId:"http-inspect",at:new Date().toISOString(),message:error instanceof Error?error.message:"Unknown error"}));return NextResponse.json({error:"PAYMENTS_NOT_CONFIGURED"},{status:503});}}
export async function POST(req:NextRequest){return paidRequest(req);}
export async function GET(){return x402DiscoveryChallenge("http-inspect");}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"content-type, payment-signature, payment-required, payment-response"}});}
