import { CheckCircle2, Tag, DollarSign, ImageOff } from "lucide-react";

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

export type { Product };

function formatPrice(price: string | undefined | null): string {
  if (!price || price === "null" || price === "0") return "-";
  return `£${price}`;
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const displayDescription =
    product.suggested_description || product.description || "";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200">
      <div className="flex gap-4">
        <div className="shrink-0">
          {product.image_url && product.image_url.startsWith("http") ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-lg border border-neutral-200 bg-white"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML =
                    '<div class="w-20 h-20 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center"><svg class="w-6 h-6 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
                }
              }}
            />
          ) : (
            <div className="w-20 h-20 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center">
              <ImageOff className="w-6 h-6 text-neutral-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-sm text-neutral-900 truncate">
              {product.name || "Untitled Product"}
            </h4>
            <span className="text-base font-bold text-emerald-700 shrink-0">
              {formatPrice(product.sell_price)}
            </span>
          </div>

          {product.category && (
            <p className="text-[11px] text-indigo-600 font-medium mb-1.5 uppercase tracking-wide">
              {product.category}
            </p>
          )}

          {displayDescription && (
            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-3">
              {displayDescription}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {product.tags && product.tags.length > 0 ? (
            product.tags.slice(0, 4).map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600"
              >
                <Tag className="w-2.5 h-2.5 mr-1 text-neutral-400" />
                {tag}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
              <Tag className="w-2.5 h-2.5 mr-1" />
              Suggested
            </span>
          )}
        </div>

        {product.cost_price &&
          product.cost_price !== "null" &&
          product.cost_price !== "0" && (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Cost: £{product.cost_price}
            </span>
          )}
      </div>
    </div>
  );
}

export function CatalogContentV2({
  products,
  businessDesc,
}: {
  products: Product[];
  businessDesc: string;
}) {
  return (
    <div className="space-y-6">
      {businessDesc && (
        <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-indigo-900">
              Business Overview
            </h4>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">
            {businessDesc}
          </p>
        </div>
      )}

      {products.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-neutral-800">
              {products.length} product{products.length !== 1 ? "s" : ""} found
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((product, i) => (
              <ProductCard key={i} product={product} index={i} />
            ))}
          </div>
        </div>
      )}

      {!businessDesc && products.length === 0 && (
        <div className="text-center py-8 text-neutral-400">
          <p className="text-sm">No data yet</p>
        </div>
      )}
    </div>
  );
}
