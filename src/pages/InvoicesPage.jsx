import { useEffect, useState } from "react";
import { toast } from "sonner"; // swap this import if you used another toast library
import { getInvoices, getInvoice } from "../api/invoices";
import { formatINR } from "../utils/money";
import ReceiptModal from "../components/ReceiptModal";

const LIMIT = 10;

export default function InvoicesPage() {
  // filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // data
  const [invoices, setInvoices] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // viewing one invoice
  const [opening, setOpening] = useState(null); // invoice number being fetched
  const [selected, setSelected] = useState(null);

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(debouncedSearch || from || to);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (rangeInvalid) return;
    let ignore = false;
    setLoading(true);
    setError(null);
    getInvoices({ page, limit: LIMIT, search: debouncedSearch, from, to })
      .then((data) => {
        if (ignore) return;
        setInvoices(data.rows ?? []);
        setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
        setTotalInvoices(data.pagination?.totalInvoices ?? 0);
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
  }, [page, debouncedSearch, from, to, rangeInvalid]);

  async function openInvoice(number) {
    if (opening) return;
    setOpening(number);
    try {
      setSelected(await getInvoice(number));
    } catch (err) {
      toast.error(
        err.status === 404 ? "That invoice no longer exists" : "Couldn't load the invoice"
      );
    } finally {
      setOpening(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-5 text-black">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl">Invoices</h1>
          <span className="text-sm text-slate-600">{totalInvoices} total</span>
        </header>

        {/* filters */}
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-search" className="text-sm font-semibold text-slate-700">
              Invoice number
            </label>
            <input
              id="inv-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. INV-2026"
              className="w-56 rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-from" className="text-sm font-semibold text-slate-700">
              From
            </label>
            <input
              id="inv-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-to" className="text-sm font-semibold text-slate-700">
              To
            </label>
            <input
              id="inv-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          {filtersActive || search ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-[#2b7cff] px-4 py-2 font-semibold text-[#1d5fd0]"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        {rangeInvalid && (
          <p role="alert" className="mb-2 text-sm font-semibold text-red-700">
            "From" must be on or before "To".
          </p>
        )}

        {/* table */}
        <div className="min-h-0 flex-1 overflow-auto border-t border-slate-200">
          {error ? (
            <p className="p-4">Could not load invoices: {error}</p>
          ) : !loading && invoices.length === 0 ? (
            <div className="p-4">
              <p>{filtersActive ? "No invoices match these filters." : "No invoices yet."}</p>
            </div>
          ) : (
            <table
              className={`w-full min-w-175 table-fixed border-collapse text-sm ${
                loading ? "opacity-60" : ""
              }`}
            >
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-600">
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Date and time</th>
                  <th className="px-2 py-2 text-right">Items</th>
                  <th className="px-2 py-2">Payment</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_number} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-2 py-2">
                      {new Date(inv.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-2 py-2 text-right">{inv.items_count}</td>
                    <td className="px-2 py-2">{inv.payment_method}</td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {formatINR(inv.total)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={Boolean(opening)}
                        onClick={() => openInvoice(inv.invoice_number)}
                        aria-label={`View invoice ${inv.invoice_number}`}
                        className="rounded-full border border-[#2b7cff] px-3 py-1 font-semibold text-[#1d5fd0] disabled:opacity-50"
                      >
                        {opening === inv.invoice_number ? "Opening..." : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {loading && invoices.length === 0 && !error && <p className="p-4">Loading invoices...</p>}
        </div>

        {/* pagination */}
        <footer className="flex items-center justify-between pt-3 text-sm text-slate-700">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:text-slate-400"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:text-slate-400"
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {selected && (
        <ReceiptModal
          title="Invoice details"
          invoice={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
