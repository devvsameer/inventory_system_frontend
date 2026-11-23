import Modal from "./Modal";
import { formatINR } from "../utils/money";

export default function ReceiptModal({ invoice, onClose, title = "Invoice created" }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div id="receipt" className="text-sm">
        <div className="mb-3 text-center">
          <p className="text-lg font-bold">POS App</p>
          <p className="font-semibold">{invoice.invoice_number}</p>
          <p className="text-slate-600">
            {new Date(invoice.created_at).toLocaleString("en-IN")}
          </p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Price</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.sku} className="border-b border-slate-100">
                <td className="py-1">{item.product_name}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{formatINR(item.unit_price)}</td>
                <td className="py-1 text-right">{formatINR(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST ({Number(invoice.tax_rate)}%)</span>
            <span>{formatINR(invoice.tax_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatINR(invoice.total)}</span>
          </div>
          <p className="pt-1 text-slate-600">Paid by {invoice.payment_method}</p>
        </div>
      </div>

      <div className="no-print mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#2b7cff] px-5 py-2 font-semibold text-[#1d5fd0]"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#2b7cff] px-5 py-2 font-semibold text-white"
        >
          Print
        </button>
      </div>
    </Modal>
  );
}
