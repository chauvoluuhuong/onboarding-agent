import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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

export function CatalogContent({
  products,
  businessDesc,
  onBusinessDescChange,
  onUpdateProduct,
}: {
  products: Product[];
  businessDesc: string;
  onBusinessDescChange: (value: string) => void;
  onUpdateProduct: (index: number, field: keyof Product, value: string) => void;
}) {
  return (
    <div className="space-y-6 pt-2">
      {(businessDesc || products.length > 0) && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-800 mb-2 flex items-center gap-2">
            <span>👋</span> Your business:
          </h4>
          <Textarea
            value={businessDesc}
            onChange={(e) => onBusinessDescChange(e.target.value)}
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
                  <th className="px-3 py-2 font-semibold w-[50px]">Img</th>
                  <th className="px-3 py-2 font-semibold min-w-[150px]">
                    Name
                  </th>
                  <th className="px-3 py-2 font-semibold min-w-[200px]">
                    Description
                  </th>
                  <th className="px-3 py-2 font-semibold w-[80px]">Cost</th>
                  <th className="px-3 py-2 font-semibold w-[80px]">Sell</th>
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
                      product.image_url.startsWith("http") ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 min-w-[2.5rem] object-cover rounded border border-neutral-200 bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
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
                          onUpdateProduct(i, "name", e.target.value)
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
                          onUpdateProduct(
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
                          product.cost_price === "null" ||
                          product.cost_price === "0"
                            ? ""
                            : product.cost_price
                        }
                        onChange={(e) =>
                          onUpdateProduct(i, "cost_price", e.target.value)
                        }
                        className="h-8 text-xs bg-white shadow-sm focus-visible:ring-emerald-500"
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        value={product.sell_price || ""}
                        onChange={(e) =>
                          onUpdateProduct(i, "sell_price", e.target.value)
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
  );
}
