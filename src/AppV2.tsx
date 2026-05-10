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
  CheckCircle2,
  Loader2,
  Globe,
  X,
  Search,
  Sparkles,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CatalogContentV2 } from "./CatalogContent_v2";
import type { Product } from "./CatalogContent_v2";
import {
  ai,
  systemInstruction,
  responseSchema,
  scrapeWebsiteTool,
} from "./services/geminiChatService";
import { cn } from "@/lib/utils";

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

type Content = any;

type ClampVariant = "user" | "assistant" | "system" | "catalog";

type OnboardingStep =
  | "ask-website"
  | "enter-url"
  | "processing"
  | "results"
  | "chat";

const PROGRESS_STEPS = [
  { icon: Search, label: "Scraping your website...", delay: 0 },
  { icon: Sparkles, label: "Analyzing your products...", delay: 3000 },
  { icon: Package, label: "Building your catalog...", delay: 6000 },
];

/** OpenTill onboarding — dark charcoal + amber accent (matches product UI) */
const OT = {
  page: "#222222",
  card: "#252525",
  cardInner: "#1e1e1e",
  border: "#333333",
  muted: "#A0A0A0",
  accent: "#FFC107",
} as const;

function OpenTillWordmark() {
  return (
    <div className="inline-flex w-fit rounded-lg bg-black px-3 py-1.5">
      <span className="text-[15px] font-bold tracking-tight text-[#FFC107]">
        OpenTill
      </span>
    </div>
  );
}

function OnboardingStepBars({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex gap-2 pt-2" role="progressbar" aria-valuenow={activeStep} aria-valuemin={1} aria-valuemax={4}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            i === activeStep ? "bg-[#FFC107]" : "bg-[#333333]",
          )}
        />
      ))}
    </div>
  );
}

function OpenTillOnboardingShell({
  stepIndex,
  stepLabel,
  title,
  subtitle,
  children,
  footer,
}: {
  stepIndex: number;
  stepLabel: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden p-4 sm:p-6 font-sans antialiased"
      style={{ backgroundColor: OT.page }}
    >
      <div
        className="w-full max-w-[520px] rounded-[24px] border border-[#333333] shadow-2xl overflow-hidden"
        style={{ backgroundColor: OT.card }}
      >
        <div className="h-px w-full bg-[#FFC107]/85" aria-hidden />
        <div className="flex flex-col gap-6 p-8 sm:p-10">
          <header className="flex flex-col gap-4">
            <OpenTillWordmark />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A0A0A0]">
              <span className="text-[#FFC107]" aria-hidden>
                ●
              </span>
              {` STEP ${stepIndex} OF 4 — ${stepLabel}`}
            </p>
            <h1 className="text-2xl sm:text-[28px] font-bold leading-tight text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm sm:text-base leading-relaxed text-[#A0A0A0] -mt-1">
                {subtitle}
              </p>
            ) : null}
          </header>
          {children}
          {footer}
          <OnboardingStepBars activeStep={stepIndex} />
        </div>
      </div>
    </div>
  );
}

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
      ? "from-[#b8860b]"
      : variant === "system"
        ? "from-[#333333]"
        : "from-[#2a2a2a]";

  const toggleBtnClass =
    variant === "user"
      ? "text-[#1a1a1a] hover:bg-[#FFC107]/25 hover:text-[#FFC107]"
      : variant === "system"
        ? "text-[#A0A0A0] hover:bg-[#333]/80 text-xs"
        : variant === "catalog"
          ? "text-[#FFC107] hover:bg-[#333]"
          : "text-[#FFC107] hover:bg-[#333]";

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
            !expanded && "text-[1.35rem] leading-none tracking-[0.15em] py-2.5",
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

function ProcessingView({ url }: { url: string }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers = PROGRESS_STEPS.map((step, i) =>
      setTimeout(() => setCurrentStep(i), step.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="h-screen flex flex-col font-sans overflow-hidden antialiased"
      style={{ backgroundColor: OT.page }}
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-[24px] border border-[#333333] p-10 text-center shadow-2xl"
          style={{ backgroundColor: OT.card }}
        >
          <div className="relative mb-8 inline-flex">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full animate-pulse"
              style={{ backgroundColor: OT.cardInner }}
            >
              {(() => {
                const StepIcon = PROGRESS_STEPS[currentStep]?.icon ?? Search;
                return <StepIcon className="h-9 w-9 text-[#FFC107]" />;
              })()}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a] border border-[#333]">
              <Loader2 className="h-4 w-4 text-[#FFC107] animate-spin" />
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            {PROGRESS_STEPS[currentStep]?.label ?? "Processing..."}
          </h2>

          <p className="text-[#A0A0A0] text-sm mb-8 break-all">{url}</p>

          <div className="flex justify-center gap-2">
            {PROGRESS_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-700",
                  i <= currentStep
                    ? "bg-[#FFC107] w-8"
                    : "bg-[#333] w-4",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsView({
  products,
  businessDesc,
  onConfirm,
}: {
  products: Product[];
  businessDesc: string;
  onConfirm: () => void;
}) {
  return (
    <div
      className="h-screen flex flex-col font-sans overflow-hidden antialiased"
      style={{ backgroundColor: OT.page }}
    >
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="h-full flex flex-col border border-[#333] overflow-hidden min-h-0 m-3 sm:m-4 rounded-[24px] shadow-2xl"
          style={{ backgroundColor: OT.card }}
        >
          <div className="h-px w-full shrink-0 bg-[#FFC107]/85" aria-hidden />
          <div className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 max-w-3xl mx-auto w-full pb-8">
                <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-3 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#FFC107]" />
                      Here's what we found!
                    </h3>
                    <p className="text-[#A0A0A0] text-xs mt-0.5">
                      We analyzed your website and found the following
                    </p>
                  </div>
                  <Button
                    onClick={onConfirm}
                    className="h-10 text-sm font-semibold px-6 shrink-0 rounded-xl bg-[#FFC107] text-[#1a1a1a] hover:bg-[#e6ac00] shadow-none border-0"
                  >
                    Confirm & continue
                  </Button>
                </div>

                <CatalogContentV2
                  products={products}
                  businessDesc={businessDesc}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppV2() {
  const [step, setStep] = useState<OnboardingStep>("ask-website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Content[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessDesc, setBusinessDesc] = useState<string>("");
  const [isStopped, setIsStopped] = useState(false);
  const [lastConversation, setLastConversation] = useState<string>("");
  const [websiteChoice, setWebsiteChoice] = useState<"yes" | "no" | null>(
    null,
  );

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
  }, [messages, isLoading, products, businessDesc, step]);

  const scrapeWebsite = async (url: string) => {
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

  const handleNoWebsite = () => {
    window.parent.postMessage(
      {
        type: "AGENT_MESSAGE",
        payload: { context: "USER_DON_NOT_HAVE_WEBSITE", stop: true },
      },
      "*",
    );
  };

  const handleWebsiteSubmit = async () => {
    if (!websiteUrl.trim()) return;
    setStep("processing");

    const userMsg = `My website is: ${websiteUrl}`;
    setIsLoading(true);

    try {
      const newUserContent = { role: "user", parts: [{ text: userMsg }] };
      const currentHistory = [newUserContent];
      const finalHistory = await processAgentTurn(currentHistory);
      setHistory(finalHistory);
    } catch (err: any) {
      console.error(err);
      setStep("enter-url");
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
          return await processAgentTurn(currentHistory);
        }
      }
    }

    const jsonStr = response.text || "";
    try {
      const data = JSON.parse(jsonStr) as AgentResponse;

      if (data.conversation) {
        setLastConversation(data.conversation);
        setMessages((p) => [
          ...p,
          {
            id: Date.now().toString(),
            role: "assistant",
            text: data.conversation,
          },
        ]);
      }

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

      setStep("results");
    } catch (e) {
      console.error("Failed to parse JSON response:", jsonStr);
      setStep("enter-url");
    }

    return currentHistory;
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
      const finalHistory = await processAgentTurnChat(currentHistory);
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

  const processAgentTurnChat = async (
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
          return await processAgentTurnChat(currentHistory);
        }
      }
    }

    const jsonStr = response.text || "";
    try {
      const data = JSON.parse(jsonStr) as AgentResponse;

      if (data.conversation) {
        setLastConversation(data.conversation);
        setMessages((p) => [
          ...p,
          {
            id: Date.now().toString(),
            role: "assistant",
            text: data.conversation,
          },
        ]);
      }

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

  if (step === "ask-website") {
    return (
      <OpenTillOnboardingShell
        stepIndex={1}
        stepLabel="BUSINESS BASICS"
        title="Tell us about your business."
        subtitle="We'll personalise your setup based on your answers."
        footer={
          <Button
            type="button"
            disabled={!websiteChoice}
            className={cn(
              "w-full h-12 rounded-xl text-base font-semibold border-0 shadow-none",
              websiteChoice
                ? "bg-[#FFC107] text-[#1a1a1a] hover:bg-[#e6ac00]"
                : "bg-[#2a2a2a] text-[#666666] cursor-not-allowed",
            )}
            onClick={() => {
              if (websiteChoice === "yes") setStep("enter-url");
              if (websiteChoice === "no") handleNoWebsite();
            }}
          >
            Continue →
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setWebsiteChoice("yes")}
            className={cn(
              "rounded-xl border p-5 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#FFC107] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252525]",
              websiteChoice === "yes"
                ? "border-[#FFC107] bg-[#1e1e1e]"
                : "border-[#333333] bg-[#1e1e1e] hover:border-[#444]",
            )}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 border border-[#333]">
              <Globe className="h-5 w-5 text-[#FFC107]" aria-hidden />
            </div>
            <p className="font-bold text-white text-base mb-1">Yes, I have one</p>
            <p className="text-sm leading-relaxed text-[#A0A0A0]">
              Share your URL and we'll import details automatically
            </p>
          </button>
          <button
            type="button"
            onClick={() => setWebsiteChoice("no")}
            className={cn(
              "rounded-xl border p-5 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#FFC107] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252525]",
              websiteChoice === "no"
                ? "border-[#FFC107] bg-[#1e1e1e]"
                : "border-[#333333] bg-[#1e1e1e] hover:border-[#444]",
            )}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 border border-[#333]">
              <X className="h-5 w-5 text-[#FFC107]" aria-hidden />
            </div>
            <p className="font-bold text-white text-base mb-1">No, I don't</p>
            <p className="text-sm leading-relaxed text-[#A0A0A0]">
              No problem — we'll set everything up from scratch
            </p>
          </button>
        </div>
      </OpenTillOnboardingShell>
    );
  }

  if (step === "enter-url") {
    return (
      <OpenTillOnboardingShell
        stepIndex={2}
        stepLabel="YOUR WEBSITE"
        title="What's your website URL?"
        subtitle="We'll look at it to understand your business better."
        footer={
          <form
            className="w-full flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleWebsiteSubmit();
            }}
          >
            <div className="flex gap-2">
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="flex-1 h-12 rounded-xl border-[#333] bg-[#1e1e1e] text-white placeholder:text-[#666] focus-visible:ring-[#FFC107] focus-visible:ring-offset-0 focus-visible:border-[#FFC107] text-base px-4"
                type="url"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!websiteUrl.trim()}
                className="h-12 w-12 shrink-0 rounded-xl p-0 border-0 shadow-none bg-[#FFC107] text-[#1a1a1a] hover:bg-[#e6ac00] disabled:bg-[#2a2a2a] disabled:text-[#555]"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                setWebsiteChoice(null);
                setStep("ask-website");
              }}
              className="text-sm text-[#A0A0A0] hover:text-white transition-colors text-center"
            >
              Go back
            </button>
          </form>
        }
      >
        <div className="min-h-[1px]" aria-hidden />
      </OpenTillOnboardingShell>
    );
  }

  if (step === "processing") {
    return <ProcessingView url={websiteUrl} />;
  }

  if (step === "results") {
    return (
      <ResultsView
        products={products}
        businessDesc={businessDesc}
        onConfirm={() => {
          window.parent.postMessage(
            {
              type: "AGENT_MESSAGE",
              payload: {
                stop: true,
                confirmed: true,
                products,
                business_description: businessDesc,
              },
            },
            "*",
          );
        }}
      />
    );
  }

  return (
    <div
      className="h-screen flex flex-col font-sans overflow-hidden antialiased"
      style={{ backgroundColor: OT.page }}
    >
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="h-full flex flex-col border border-[#333] overflow-hidden min-h-0 m-3 sm:m-4 rounded-[24px] shadow-2xl"
          style={{ backgroundColor: OT.card }}
        >
          <div className="h-px w-full shrink-0 bg-[#FFC107]/85" aria-hidden />
          <div className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
            <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
              <div className="p-4 space-y-6 max-w-3xl mx-auto w-full pb-8">
                {messages.map((msg) => {
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
                        <div className="max-w-[85%] w-full p-4 rounded-2xl border border-[#333] text-white rounded-bl-sm shadow-sm bg-[#1e1e1e]">
                          <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-3 pb-3 mb-1 border-b border-[#333]">
                            <div>
                              <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#FFC107]" />
                                Updated catalog
                              </h3>
                              <p className="text-[#A0A0A0] text-xs mt-0.5">
                                Latest products and business info
                              </p>
                            </div>
                            <Button
                              onClick={() => setStep("results")}
                              className="h-8 text-xs font-semibold px-4 shrink-0 rounded-lg bg-[#FFC107] text-[#1a1a1a] hover:bg-[#e6ac00] border-0 shadow-none"
                            >
                              Back to results
                            </Button>
                          </div>
                          <ClampedBlock
                            resetKey={msg.id}
                            measureKey={catalogMeasureKey}
                            variant="catalog"
                          >
                            <CatalogContentV2
                              products={products}
                              businessDesc={businessDesc}
                            />
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
                            ? "bg-[#FFC107] text-[#1a1a1a] rounded-br-sm shadow-md"
                            : msg.role === "system"
                              ? "bg-[#2a2a2a] text-[#A0A0A0] text-[10px] text-center mx-auto rounded-full px-4 border border-[#333]"
                              : "bg-[#1e1e1e] border border-[#333] text-[#e8e8e8] rounded-bl-sm shadow-sm"
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
                              ? "prose prose-sm md:prose-base max-w-none prose-headings:text-[#1a1a1a] prose-p:text-[#1a1a1a] prose-strong:text-[#1a1a1a] prose-a:text-[#1a1a1a]"
                              : msg.role === "system"
                                ? "prose prose-invert max-w-none text-[10px] leading-snug text-[#A0A0A0]"
                                : "prose prose-invert max-w-none text-sm md:text-base prose-headings:text-white prose-p:text-[#e0e0e0]"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-[#1e1e1e] border border-[#333] p-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-[#FFC107] animate-spin" />
                      <span className="text-sm text-[#A0A0A0]">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div
              className="p-4 border-t border-[#333] flex-shrink-0"
              style={{ backgroundColor: OT.cardInner }}
            >
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
                  className="flex-1 h-12 rounded-xl border-[#333] bg-[#252525] text-white placeholder:text-[#666] focus-visible:ring-[#FFC107] focus-visible:ring-offset-0 focus-visible:border-[#FFC107] text-base px-4"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="h-12 w-12 shrink-0 rounded-xl p-0 border-0 shadow-none bg-[#FFC107] text-[#1a1a1a] hover:bg-[#e6ac00] disabled:bg-[#2a2a2a] disabled:text-[#555]"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
