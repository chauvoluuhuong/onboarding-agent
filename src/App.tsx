import { useState, useRef, useEffect } from "react";
import { Send, Store, PackageSearch, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ai, systemInstruction, responseSchema, scrapeWebsiteTool } from "./services/geminiChatService";

type Product = {
  name: string;
  image_url: string;
  sell_price: string;
  cost_price: string;
  description: string;
  suggested_description: string;
  category: string;
  tags: string[];
};

type AgentResponse = {
  conversation: string;
  stop: boolean;
  products: Product[];
  business_description?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

// Represents history for the SDK
type Content = any;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", text: "Do you have a website or tell us some your highlight products?" }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Content[]>([]);
  
  // Dashboard state
  const [products, setProducts] = useState<Product[]>([]);
  const [businessDesc, setBusinessDesc] = useState<string>("");
  const [isStopped, setIsStopped] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    setProducts(prev => {
      const newProducts = [...prev];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return newProducts;
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const scrapeWebsite = async (url: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "system", text: `Scraping website: ${url}...` }]);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error("Failed to scrape");
      const data = await res.json();
      return data.text;
    } catch (e: any) {
      return `Error scraping: ${e.message}`;
    }
  };

  const executeTurn = async (userText: string) => {
    if (!userText.trim()) return;

    const newMessages = [...messages, { id: Date.now().toString(), role: "user" as const, text: userText }];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    try {
      const newUserContent = { role: "user", parts: [{ text: userText }] };
      const currentHistory = [...history, newUserContent];
      
      let finalHistory = await processAgentTurn(currentHistory);
      setHistory(finalHistory);
    } catch (err: any) {
      console.error(err);
      setMessages(p => [...p, { id: Date.now().toString(), role: "system", text: "An error occurred communicating with the AI." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processAgentTurn = async (currentHistory: Content[]): Promise<Content[]> => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: currentHistory,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        tools: [{ functionDeclarations: [scrapeWebsiteTool] }],
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidate returned");

    const assistantContent = candidate.content;
    currentHistory.push(assistantContent);

    // Check for tool calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        if (call.name === "scrapeWebsite") {
          const url = call.args?.url as string;
          const content = await scrapeWebsite(url);
          
          const toolResponseContent = {
            role: "user",
            parts: [{
              functionResponse: {
                name: "scrapeWebsite",
                response: { content }
              }
            }]
          };
          currentHistory.push(toolResponseContent);
          
          // Re-trigger the model with the tool output
          return await processAgentTurn(currentHistory);
        }
      }
    }

    // Process text response (which should be JSON)
    const jsonStr = response.text || "";
    try {
      const data = JSON.parse(jsonStr) as AgentResponse;
      
      if (data.conversation) {
        setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", text: data.conversation }]);
      }

      // Notify parent app of the agent's current state/message (useful for Iframe integration)
      window.parent.postMessage(
        {
          type: "AGENT_MESSAGE",
          payload: data
        },
        "*"
      );

      if (data.products && data.products.length > 0) {
        setProducts(data.products);
      }
      if (data.business_description) {
        setBusinessDesc(data.business_description);
      }
      if (data.stop) {
        setIsStopped(true);
      }
    } catch(e) {
      console.error("Failed to parse JSON response:", jsonStr);
      setMessages(p => [...p, { id: Date.now().toString(), role: "system", text: "The agent returned an invalid response format." }]);
    }

    return currentHistory;
  };

  const hasData = businessDesc || products.length > 0 || isStopped;

  return (
    <div className="min-h-screen bg-neutral-100 p-2 md:p-4 font-sans">
      <div className={`mx-auto w-full transition-all duration-500 ease-in-out ${hasData ? 'max-w-7xl grid grid-cols-1 lg:grid-cols-3' : 'max-w-3xl flex flex-col'} gap-4 md:gap-8`}>
        
        {/* Chat Interface */}
        <Card className={`flex flex-col h-[85vh] shadow-lg border-neutral-200 transition-all duration-500 ease-in-out w-full ${hasData ? 'col-span-1' : ''}`}>
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-neutral-50/50 rounded-xl">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  if (messages.length === 1 && idx === 0) {
                    return (
                      <div key={msg.id} className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                          <Store className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4 tracking-tight">
                          Hi there, let us understand you!
                        </h2>
                        <p className="text-neutral-600 text-lg max-w-md leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-sm' 
                          : msg.role === 'system'
                          ? 'bg-neutral-200 text-neutral-600 text-xs text-center mx-auto'
                          : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-white border border-neutral-200 p-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span className="text-sm text-neutral-500">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 bg-white border-t border-neutral-100">
              <form 
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  executeTurn(inputText);
                }}
              >
                <Input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isStopped ? "Onboarding complete" : "Type your message..."}
                  disabled={isLoading || isStopped}
                  className="flex-1 border-neutral-300 focus-visible:ring-indigo-600 h-10 shadow-sm"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || isStopped || !inputText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 h-10 w-10 p-0 shadow-sm transition-colors"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Extracted Data Dashboard */}
        {hasData && (
          <div className="flex flex-col h-[85vh] gap-4 lg:col-span-2 animate-in fade-in slide-in-from-right-4 duration-500">
            <Card className="shadow-md border-neutral-200 bg-white flex flex-col h-full overflow-hidden">
              <CardHeader className="py-6 bg-emerald-50/50 border-b border-emerald-100 flex-shrink-0">
                <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      Your Draft Catalog
                    </CardTitle>
                    <p className="text-emerald-700/80 text-sm mt-1">Review and refine the details we gathered before saving.</p>
                  </div>
                  {products.length > 0 && (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shadow-sm">
                      Save Catalog
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                <ScrollArea className="flex-1 h-full">
                  <div className="p-6">
                    {/* Business Profile Section */}
                    {(businessDesc || products.length > 0 || isStopped) ? (
                      <div className="mb-8">
                        <h3 className="text-lg font-medium text-neutral-800 mb-3 flex items-center gap-2">
                          <span className="text-xl">👋</span> Hey there, I have noted that:
                        </h3>
                        <Textarea 
                          value={businessDesc} 
                          onChange={(e) => setBusinessDesc(e.target.value)} 
                          className="w-full min-h-[120px] bg-white border-neutral-300 text-base shadow-sm focus-visible:ring-emerald-500 rounded-lg p-4"
                          placeholder="Describe your business here..."
                        />
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center text-neutral-400">
                        <PackageSearch className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">Store details will appear here as the assistant discovers them.</p>
                      </div>
                    )}

                    {/* Products Section */}
                    {products.length > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-lg font-medium text-neutral-800 mb-3">
                          And some of your main products are:
                        </h3>
                        <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white shadow-sm">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                              <tr>
                                <th className="px-4 py-3 font-semibold w-[40px]"></th>
                                <th className="px-4 py-3 font-semibold w-[60px]">Image</th>
                                <th className="px-4 py-3 font-semibold min-w-[200px]">Product Name</th>
                                <th className="px-4 py-3 font-semibold min-w-[300px]">Description</th>
                                <th className="px-4 py-3 font-semibold w-[120px]">Cost</th>
                                <th className="px-4 py-3 font-semibold w-[120px]">Sell Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {products.map((product, i) => (
                                <tr key={i} className="hover:bg-neutral-50/50 transition-colors">
                                  <td className="px-4 py-3 align-top">
                                    <Checkbox 
                                      id={`product-${i}`} 
                                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mt-1.5" 
                                      defaultChecked 
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    {product.image_url && product.image_url.startsWith('http') ? (
                                      <img 
                                        src={product.image_url} 
                                        alt={product.name} 
                                        className="w-12 h-12 min-w-[3rem] object-cover rounded border border-neutral-200 bg-white"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<div class="w-12 h-12 min-w-[3rem] bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center text-neutral-400 text-[10px]">No img</div>'; }}
                                      />
                                    ) : (
                                      <div className="w-12 h-12 min-w-[3rem] bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center text-neutral-400 text-[10px]">No img</div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <Input 
                                      value={product.name || ""} 
                                      onChange={(e) => updateProduct(i, 'name', e.target.value)} 
                                      className="h-9 bg-white shadow-sm focus-visible:ring-emerald-500" 
                                      placeholder="Product name"
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <Textarea 
                                      value={product.suggested_description || product.description || ""} 
                                      onChange={(e) => updateProduct(i, 'suggested_description', e.target.value)} 
                                      className="min-h-[80px] text-sm resize-y bg-white shadow-sm focus-visible:ring-emerald-500" 
                                      placeholder="Product description"
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <Input 
                                      value={(!product.cost_price || product.cost_price === "null" || product.cost_price === "0") ? "" : product.cost_price} 
                                      onChange={(e) => updateProduct(i, 'cost_price', e.target.value)} 
                                      className="h-9 bg-white shadow-sm focus-visible:ring-emerald-500" 
                                      placeholder="-"
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <Input 
                                      value={product.sell_price || ""} 
                                      onChange={(e) => updateProduct(i, 'sell_price', e.target.value)} 
                                      className="h-9 bg-white font-medium shadow-sm focus-visible:ring-emerald-500" 
                                      placeholder="-"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
