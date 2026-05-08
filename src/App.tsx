import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  PackageSearch,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ai,
  systemInstruction,
  responseSchema,
  scrapeWebsiteTool,
} from "./services/geminiChatService";
import openTillLogo from "./assets/opentill-logo.png";
import { cn } from "@/lib/utils";

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
  role: "user" | "assistant" | "system" | "catalog";
  text: string;
  component?: React.ReactNode;
};

// Represents history for the SDK
type Content = any;

type ClampVariant = "user" | "assistant" | "system" | "catalog";

function ClampedBlock({
  resetKey,
  measureKey,
  variant,
  children,
}: {
  resetKey: string;
  measureKey: string;
  variant: ClampVariant;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    if (expanded) return;
    const overflows = el.scrollHeight > el.clientHeight + 1;
    setIsTruncatable(overflows);
  }, [expanded]);

  useLayoutEffect(() => {
    setIsTruncatable(false);
    setExpanded(false);
  }, [resetKey]);

  useLayoutEffect(() => {
    measure();
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, measureKey, expanded]);

  const gradientFrom =
    variant === "user"
      ? "from-indigo-600"
      : variant === "system"
        ? "from-neutral-200"
        : "from-white";

  const toggleBtnClass =
    variant === "user"
      ? "text-indigo-100 hover:bg-indigo-500/35 hover:text-white"
      : variant === "system"
        ? "text-neutral-700 hover:bg-neutral-300/50 text-xs"
        : variant === "catalog"
          ? "text-emerald-700 hover:bg-emerald-50"
          : "text-indigo-600 hover:bg-indigo-50";

  const showToggle = isTruncatable || expanded;

  return (
    <div className="w-full">
      <div
        ref={outerRef}
        className={cn("relative", !expanded && "max-h-[40vh] overflow-hidden")}
      >
        {children}
        {!expanded && isTruncatable && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 right-0 h-14 bg-linear-to-t to-transparent",
              gradientFrom,
            )}
            aria-hidden
          />
        )}
      </div>
      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="default"
          className={cn(
            "mt-2 min-h-11 min-w-11 px-4 text-sm font-semibold rounded-lg",
            !expanded &&
              "text-[1.35rem] leading-none tracking-[0.15em] py-2.5",
            toggleBtnClass,
          )}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Show less" : "Show full message"}
        >
          {expanded ? "Show less" : "···"}
        </Button>
      )}
    </div>
  );
}

function ClampedMarkdownMessage({
  messageId,
  text,
  variant,
  proseClassName,
}: {
  messageId: string;
  text: string;
  variant: Exclude<ClampVariant, "catalog">;
  proseClassName: string;
}) {
  return (
    <ClampedBlock
      resetKey={`${messageId}\0${text}`}
      measureKey={text}
      variant={variant}
    >
      <div className={proseClassName}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </ClampedBlock>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      text: "Do you have a website or tell us some your highlight products?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Content[]>([]);

  // Dashboard state
  const [products, setProducts] = useState<Product[]>([]);
  const [businessDesc, setBusinessDesc] = useState<string>("");
  const [isStopped, setIsStopped] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const updateProduct = (
    index: number,
    field: keyof Product,
    value: string,
  ) => {
    setProducts((prev) => {
      const newProducts = [...prev];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return newProducts;
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading, products, businessDesc]);

  const scrapeWebsite = async (url: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "system",
        text: `Scraping website: ${url}...`,
      },
    ]);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
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

    if (isStopped) setIsStopped(false);

    const newMessages = [
      ...messages,
      { id: Date.now().toString(), role: "user" as const, text: userText },
    ];
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
      setMessages((p) => [
        ...p,
        {
          id: Date.now().toString(),
          role: "system",
          text: "An error occurred communicating with the AI.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const processAgentTurn = async (
    currentHistory: Content[],
  ): Promise<Content[]> => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: currentHistory,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        tools: [{ functionDeclarations: [scrapeWebsiteTool] }],
        toolConfig: { includeServerSideToolInvocations: true },
      },
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
            parts: [
              {
                functionResponse: {
                  name: "scrapeWebsite",
                  response: { content },
                },
              },
            ],
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
        setMessages((p) => [
          ...p,
          {
            id: Date.now().toString(),
            role: "assistant",
            text: data.conversation,
          },
        ]);
      }

      // If we have products or business description, add a catalog message
      if (
        (data.products && data.products.length > 0) ||
        data.business_description
      ) {
        setMessages((p) => [
          ...p,
          { id: `cat-${Date.now()}`, role: "catalog", text: "" },
        ]);
      }

      // Notify parent app of the agent's current state/message (useful for Iframe integration)
      window.parent.postMessage(
        {
          type: "AGENT_MESSAGE",
          payload: data,
        },
        "*",
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
    } catch (e) {
      console.error("Failed to parse JSON response:", jsonStr);
      setMessages((p) => [
        ...p,
        {
          id: Date.now().toString(),
          role: "system",
          text: "The agent returned an invalid response format.",
        },
      ]);
    }

    return currentHistory;
  };

  const hasData = businessDesc || products.length > 0 || isStopped;

  const catalogMeasureKey = useMemo(
    () =>
      `${businessDesc}\n${products
        .map(
          (p) =>
            `${p.name ?? ""}\0${p.suggested_description || p.description || ""}\0${p.sell_price ?? ""}\0${p.cost_price ?? ""}`,
        )
        .join("\n")}`,
    [businessDesc, products],
  );

  return (
    <div className="h-screen bg-neutral-100 flex flex-col font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Interface */}
        <Card className="h-full flex flex-col shadow-lg border-neutral-200 overflow-hidden bg-white/80 backdrop-blur-sm min-h-0">
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-neutral-50/50 rounded-xl min-h-0">
            <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
              <div className="p-4 space-y-6 max-w-3xl mx-auto w-full pb-8">
                {messages.map((msg, idx) => {
                  if (messages.length === 1 && idx === 0) {
                    return (
                      <div
                        key={msg.id}
                        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-500"
                      >
                        <img
                          src={openTillLogo}
                          alt="OpenTill"
                          className="w-44 max-w-[85vw] h-auto mb-6 object-contain drop-shadow-md"
                        />
                        <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4 tracking-tight">
                          Hi there, let us listen to you!
                        </h2>
                        <p className="text-neutral-600 text-xl max-w-md leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    );
                  }

                  if (msg.component) {
                    return (
                      <div key={msg.id} className="w-full">
                        {msg.component}
                      </div>
                    );
                  }

                  if (msg.role === "catalog") {
                    return (
                      <div
                        key={msg.id}
                        className="flex justify-start animate-in fade-in slide-in-from-bottom-2 w-full mb-6"
                      >
                        <div className="max-w-[85%] w-full p-4 rounded-2xl bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm shadow-sm">
                          <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-3 pb-3 mb-1 border-b border-neutral-100">
                            <div>
                              <h3 className="text-base font-semibold text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                                Hi! Here are some my noted
                              </h3>
                              <p className="text-emerald-700/80 text-xs mt-0.5">
                                Feel free to edit or add more details.
                              </p>
                            </div>
                            {products.length > 0 && (
                              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium px-4 shadow-sm transition-all transform active:scale-95 shrink-0">
                                Confirm
                              </Button>
                            )}
                          </div>
                          <ClampedBlock
                            resetKey={msg.id}
                            measureKey={catalogMeasureKey}
                            variant="catalog"
                          >
                            <div className="space-y-6 pt-2">
                              {(businessDesc || products.length > 0) && (
                                <div>
                                  <h4 className="text-sm font-semibold text-neutral-800 mb-2 flex items-center gap-2">
                                    <span>👋</span> Your business:
                                  </h4>
                                  <Textarea
                                    value={businessDesc}
                                    onChange={(e) =>
                                      setBusinessDesc(e.target.value)
                                    }
                                    className="w-full min-h-[80px] bg-white border-neutral-200 text-sm shadow-sm focus-visible:ring-emerald-500 rounded-md p-3"
                                    placeholder="Describe your business here..."
                                  />
                                </div>
                              )}

                              {products.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-neutral-800">
                                    Product List:
                                  </h4>
                                  <div className="border border-neutral-200 rounded-md overflow-x-auto bg-white shadow-sm hover:border-emerald-200 transition-colors">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold w-[30px]"></th>
                                          <th className="px-3 py-2 font-semibold w-[50px]">
                                            Img
                                          </th>
                                          <th className="px-3 py-2 font-semibold min-w-[150px]">
                                            Name
                                          </th>
                                          <th className="px-3 py-2 font-semibold min-w-[200px]">
                                            Description
                                          </th>
                                          <th className="px-3 py-2 font-semibold w-[80px]">
                                            Cost
                                          </th>
                                          <th className="px-3 py-2 font-semibold w-[80px]">
                                            Sell
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-100">
                                        {products.map((product, i) => (
                                          <tr
                                            key={i}
                                            className="hover:bg-neutral-50/50 transition-colors"
                                          >
                                            <td className="px-3 py-2 align-top">
                                              <Checkbox
                                                id={`product-${i}`}
                                                className="h-4 w-4 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mt-1"
                                                defaultChecked
                                              />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                              {product.image_url &&
                                              product.image_url.startsWith(
                                                "http",
                                              ) ? (
                                                <img
                                                  src={product.image_url}
                                                  alt={product.name}
                                                  className="w-10 h-10 min-w-[2.5rem] object-cover rounded border border-neutral-200 bg-white"
                                                  onError={(e) => {
                                                    e.currentTarget.style.display =
                                                      "none";
                                                    e.currentTarget.parentElement!.innerHTML =
                                                      '<div class="w-10 h-10 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center text-neutral-400 text-[8px]">No img</div>';
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-10 h-10 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center text-neutral-400 text-[8px]">
                                                  No img
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                              <Input
                                                value={product.name || ""}
                                                onChange={(e) =>
                                                  updateProduct(
                                                    i,
                                                    "name",
                                                    e.target.value,
                                                  )
                                                }
                                                className="h-8 text-xs bg-white shadow-sm focus-visible:ring-emerald-500"
                                                placeholder="Name"
                                              />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                              <Textarea
                                                value={
                                                  product.suggested_description ||
                                                  product.description ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateProduct(
                                                    i,
                                                    "suggested_description",
                                                    e.target.value,
                                                  )
                                                }
                                                className="min-h-[60px] text-xs resize-y bg-white shadow-sm focus-visible:ring-emerald-500"
                                                placeholder="Description"
                                              />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                              <Input
                                                value={
                                                  !product.cost_price ||
                                                  product.cost_price ===
                                                    "null" ||
                                                  product.cost_price === "0"
                                                    ? ""
                                                    : product.cost_price
                                                }
                                                onChange={(e) =>
                                                  updateProduct(
                                                    i,
                                                    "cost_price",
                                                    e.target.value,
                                                  )
                                                }
                                                className="h-8 text-xs bg-white shadow-sm focus-visible:ring-emerald-500"
                                                placeholder="-"
                                              />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                              <Input
                                                value={
                                                  product.sell_price || ""
                                                }
                                                onChange={(e) =>
                                                  updateProduct(
                                                    i,
                                                    "sell_price",
                                                    e.target.value,
                                                  )
                                                }
                                                className="h-8 text-xs bg-white font-medium shadow-sm focus-visible:ring-emerald-500"
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
                          </ClampedBlock>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
                    >
                      <div
                        className={`max-w-[85%] p-4 rounded-2xl ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-sm shadow-md"
                            : msg.role === "system"
                              ? "bg-neutral-200 text-neutral-600 text-[10px] text-center mx-auto rounded-full px-4"
                              : "bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm shadow-sm"
                        }`}
                      >
                        <ClampedMarkdownMessage
                          messageId={msg.id}
                          text={msg.text}
                          variant={
                            msg.role === "user"
                              ? "user"
                              : msg.role === "system"
                                ? "system"
                                : "assistant"
                          }
                          proseClassName={
                            msg.role === "user"
                              ? "prose prose-sm md:prose-base prose-invert max-w-none"
                              : msg.role === "system"
                                ? "prose prose-neutral max-w-none text-[10px] leading-snug"
                                : "prose prose-neutral max-w-none text-sm md:text-base"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-white border border-neutral-200 p-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span className="text-sm text-neutral-500">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 bg-white border-t border-neutral-100 flex-shrink-0">
              <form
                className="max-w-3xl mx-auto w-full flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  executeTurn(inputText);
                }}
              >
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isLoading
                      ? "Assistant is thinking..."
                      : "Reply to assistant..."
                  }
                  disabled={isLoading}
                  className="flex-1 border-neutral-300 focus-visible:ring-indigo-600 h-12 shadow-sm text-base px-4 bg-white"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 h-12 w-12 p-0 shadow-md transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
