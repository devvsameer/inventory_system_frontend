import { useEffect, useState } from "react";
import { toast } from "sonner"; // swap this import if you used another toast library
import { getProducts } from "../api/products";
import { createInvoice } from "../api/invoices";
import { calcTotals, formatINR, formatPaise, toPaise, TAX_RATE } from "../utils/money";
import ReceiptModal from "../components/ReceiptModal";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD"];

export default function BillingsPage() {
  // product search
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // the bill (browser state only until checkout)
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState({}); // sku -> message from a 409
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    getProducts({ page: 1, limit: 12, search: debounced })
      .then((data) => {
        if (!ignore) setProducts(data.rows ?? []);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [debounced, refreshKey]);

  const quantityInCart = (sku) => cart.find((i) => i.sku === sku)?.quantity ?? 0;

  function addToCart(product) {
    setProblems({});
    setCart((prev) => {
      const existing = prev.find((i) => i.sku === product.sku);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.sku === product.sku ? { ...i, quantity: i.quantity + 1, stock: product.stock } : i
        );
      }
      return [
        ...prev,
        { sku: product.sku, name: product.name, price: product.price, stock: product.stock, quantity: 1 },
      ];
    });
  }

  function changeQuantity(sku, delta) {
    setProblems({});
    setCart((prev) =>
      prev.map((i) =>
        i.sku === sku
          ? { ...i, quantity: Math.max(1, Math.min(i.quantity + delta, i.stock)) }
          : i
      )
    );
  }

  const removeItem = (sku) => setCart((prev) => prev.filter((i) => i.sku !== sku));

  async function handleCheckout() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setProblems({});
    try {
      const invoice = await createInvoice({
        items: cart.map(({ sku, quantity }) => ({ sku, quantity })),
        payment_method: paymentMethod,
      });
      setReceipt(invoice);
      setCart([]);
      setRefreshKey((k) => k + 1);
      toast.success(`Invoice ${invoice.invoice_number} created`);
    } catch (err) {
      if (err.status === 409 && err.body?.shortages) {
        const map = {};
        err.body.shortages.forEach((s) => {
          map[s.sku] = `Only ${s.available} in stock`;
        });
        setProblems(map);
        setRefreshKey((k) => k + 1);
        toast.error("Some items don't have enough stock");
      } else if (err.status === 404 && err.body?.missing) {
        setCart((prev) => prev.filter((i) => !err.body.missing.includes(i.sku)));
        setRefreshKey((k) => k + 1);
        toast.error("Some products no longer exist and were removed from the bill");
      } else if (err.status === 400) {
        toast.error(err.body?.errors?.[0]?.msg ?? "The bill isn't valid");
      } else {
        toast.error("Couldn't reach the server. Your bill is still here, try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const totals = calcTotals(cart);

  return (
    <div className="flex min-h-0 flex-1 gap-5 p-5">
      {/* Left: find products */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl bg-white p-5 text-black">
        <h1 className="mb-3 text-xl">Add items</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Scan SKU or type product name"
          aria-label="Search products"
          autoFocus
          className="mb-4 w-full rounded-xl border-2 border-[#2b7cff] px-4 py-2"
        />

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && <p>Loading products...</p>}
          {error && <p>Could not load products: {error}</p>}
          {!loading && !error && products.length === 0 && (
            <p>No products match "{debounced}".</p>
          )}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {products.map((p) => {
              const outOfStock = p.stock <= 0;
              const maxed = quantityInCart(p.sku) >= p.stock;
              const low = p.stock > 0 && p.stock <= p.low_stock_threshold;
              return (
                <button
                  key={p.sku}
                  type="button"
                  disabled={outOfStock || maxed}
                  onClick={() => addToCart(p)}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left ${
                    outOfStock || maxed
                      ? "cursor-not-allowed bg-slate-100 text-slate-500"
                      : "border-slate-300 hover:border-[#2b7cff] hover:bg-blue-50"
                  }`}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-sm text-slate-600">{p.sku}</span>
                  <span className="mt-1 text-lg font-bold text-[#1d5fd0]">
                    {formatINR(p.price)}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      outOfStock ? "text-red-700" : low ? "text-yellow-800" : "text-green-700"
                    }`}
                  >
                    {outOfStock
                      ? "Out of stock"
                      : maxed
                      ? "All in bill"
                      : low
                      ? `Only ${p.stock} left`
                      : `${p.stock} in stock`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right: the bill */}
      <section className="flex w-[430px] shrink-0 flex-col rounded-2xl bg-white p-5 text-black">
        <h2 className="mb-3 text-xl">Current invoice</h2>

        <div className="min-h-0 flex-1 overflow-auto">
          {cart.length === 0 ? (
            <p className="text-slate-600">No items yet. Click a product to add it.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-1">Item</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1 text-right">Total</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.sku} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-slate-600">{formatINR(item.price)} each</div>
                      {problems[item.sku] && (
                        <div className="font-semibold text-red-700">{problems[item.sku]}</div>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name}`}
                          disabled={item.quantity <= 1}
                          onClick={() => changeQuantity(item.sku, -1)}
                          className="h-7 w-7 rounded border border-slate-300 disabled:text-slate-400"
                        >
                          −
                        </button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name}`}
                          disabled={item.quantity >= item.stock}
                          onClick={() => changeQuantity(item.sku, 1)}
                          className="h-7 w-7 rounded border border-slate-300 disabled:text-slate-400"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      {formatPaise(toPaise(item.price) * item.quantity)}
                    </td>
                    <td className="py-2 pl-1">
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.sku)}
                        className="text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPaise(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST ({TAX_RATE}%)</span>
            <span>{formatPaise(totals.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-lg font-bold">
            <span>Total payable</span>
            <span>{formatPaise(totals.total)}</span>
          </div>
        </div>

        <fieldset className="my-3 flex items-center gap-4 text-sm">
          <legend className="sr-only">Payment method</legend>
          <span>Payment</span>
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input
                type="radio"
                name="payment"
                value={m}
                checked={paymentMethod === m}
                onChange={() => setPaymentMethod(m)}
              />
              {m === "CASH" ? "Cash" : m}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={cart.length === 0 || submitting}
          className="rounded-full bg-[#2b7cff] py-3 text-lg font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Processing..." : "Checkout"}
        </button>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCart([]);
              setProblems({});
            }}
            className="mt-2 rounded-full border border-[#2b7cff] py-2 font-semibold text-[#1d5fd0]"
          >
            Clear bill
          </button>
        )}
      </section>

      {receipt && <ReceiptModal invoice={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
