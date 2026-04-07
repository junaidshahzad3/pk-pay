"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, 
  Settings, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Globe, 
  Smartphone,
  Info,
  ExternalLink,
  Code2
} from "lucide-react";
import { playgroundConfigSchema, defaultRequestSchema, type PlaygroundConfig, type DefaultRequest } from "./schemas";
import { createPlaygroundPayment } from "./actions";

export default function Playground() {
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 11));
  const [events, setEvents] = useState<any[]>([]);
  const [config, setConfig] = useState<PlaygroundConfig>({
    environment: "sandbox",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "request">("config");

  // Webhook polling
  useEffect(() => {
    const pollEvents = async () => {
      try {
        const resp = await fetch(`/api/events/${sessionId}`);
        const data = await resp.json();
        if (data.success) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    const interval = setInterval(pollEvents, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const requestForm = useForm<DefaultRequest>({
    resolver: zodResolver(defaultRequestSchema),
    defaultValues: {
      provider: "jazzcash",
      amount: 1000,
      currency: "PKR",
      description: "Playground Test Payment",
    },
  });

  const onHandlePayment = async (data: DefaultRequest) => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await createPlaygroundPayment(config, data);
      setResult(resp);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-purple-500/30 pb-20">
      {/* Header */}
      <nav className="border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Play className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight">pk-pay <span className="text-purple-500">Playground</span></span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> v0.2.0</span>
            <div className="h-4 w-px bg-white/10" />
            <a href="https://github.com/junaidshahzad3/pk-pay" target="_blank" className="hover:text-white transition-colors flex items-center gap-1.5">Docs <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar / Config */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Configuration
                </h2>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 uppercase font-bold tracking-tighter">Transient Session</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Environment</label>
                  <select 
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    value={config.environment}
                    onChange={(e) => setConfig({ ...config, environment: e.target.value as any })}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <div className="space-y-4">
                  <p className="text-[11px] text-gray-500 leading-tight">Enter your API credentials to perform a live handshake through the SDK backend.</p>
                  
                  {/* Stripe Config */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium">Stripe</span>
                    </div>
                    <input 
                      type="password" 
                      placeholder="Secret Key (sk_test_...)"
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs mb-2 transition-all focus:border-blue-500/50 outline-none"
                      onChange={(e) => setConfig({ ...config, stripe: { ...config.stripe, secretKey: e.target.value } })}
                    />
                  </div>

                  {/* JazzCash Config */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Smartphone className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium">JazzCash</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Merchant ID"
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs mb-2 transition-all focus:border-yellow-500/40 outline-none"
                      onChange={(e) => setConfig({ ...config, jazzcash: { ...config.jazzcash, merchantId: e.target.value } })}
                    />
                  </div>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-200">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" />
                  <div className="text-xs leading-relaxed">
                    <p className="mb-2 font-semibold">Live Webhook Testing:</p>
                    <p className="mb-2 text-gray-400">Point your provider notifications to this session URL:</p>
                    <div className="bg-black/60 p-2 rounded border border-white/10 font-mono mb-2 text-[10px] break-all select-all">
                      https://pk-pay.dev/api/webhook/{sessionId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-8 space-y-8">
            
            {/* Request Builder */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-500" /> Create Payment
                </h2>
              </div>

              <form onSubmit={requestForm.handleSubmit(onHandlePayment)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                   <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500">Provider</label>
                   <div className="grid grid-cols-3 gap-3">
                     {['jazzcash', 'easypaisa', 'stripe'].map((p) => (
                       <button
                         key={p}
                         type="button"
                         onClick={() => requestForm.setValue('provider', p)}
                         className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all capitalize ${
                           requestForm.watch('provider') === p 
                            ? "bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/5" 
                            : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"
                         }`}
                       >
                         {p}
                       </button>
                     ))}
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5">Currency</label>
                  <select 
                    {...requestForm.register("currency")}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5">Amount (Cents/Paisas)</label>
                  <input 
                    type="number"
                    {...requestForm.register("amount", { valueAsNumber: true })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                    placeholder="e.g. 5000 (Rs. 50.00)"
                  />
                </div>

                <div className="md:col-span-2">
                  <button 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? "Processing..." : "Initialize SDK Transaction"}
                  </button>
                </div>
              </form>
            </div>

            {/* Live Result View */}
            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`border rounded-2xl p-8 backdrop-blur-md ${result.success ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    {result.success ? <CheckCircle2 className="text-green-500" /> : <AlertCircle className="text-red-500" />}
                    <h3 className="text-lg font-bold">{result.success ? "SDK Handshake Success" : "Handshake Failed"}</h3>
                  </div>

                  {result.success ? (
                    <div className="space-y-6">
                      <div className="bg-black/60 rounded-xl p-4 border border-white/5 font-mono text-[11px] text-purple-300 overflow-x-auto">
                        <pre>{JSON.stringify(result.data, null, 2)}</pre>
                      </div>
                      <div className="flex gap-4">
                        {result.data.redirectUrl && (
                          <a href={result.data.redirectUrl} target="_blank" className="flex-1 py-4 bg-white text-black text-center font-bold rounded-xl hover:bg-gray-200 transition-colors">
                            Launch Redirect
                          </a>
                        )}
                        {result.data.redirectForm && (
                          <button className="flex-1 py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors">
                            Submit Form (POST)
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm font-mono bg-red-950/20 p-4 rounded-lg border border-red-900/50">{result.error}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Webhooks Feed */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-purple-500" /> Live Webhooks
                </h2>
                {events.length > 0 && (
                  <button onClick={() => setEvents([])} className="text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors tracking-tighter">Clear Feed</button>
                )}
              </div>

              {events.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-gray-600">
                   <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Code2 className="w-6 h-6 opacity-20" />
                   </div>
                   <p className="text-xs">Listening for incoming events from your session URL...</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {events.map((event: any) => (
                    <motion.div 
                      key={event.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="bg-black/60 border border-white/5 p-5 rounded-xl space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{event.payload.pp_ResponseCode ? "JAZZCASH" : "WEBHOOK"}</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-600">{new Date(event.receivedAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="bg-black/40 p-4 rounded-lg border border-white/5 font-mono text-[10px] text-green-400 overflow-x-auto">
                        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
