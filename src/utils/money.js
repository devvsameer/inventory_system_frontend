export const TAX_RATE = 18; // keep in sync with the backend

// Whole paise, so no floating point rounding surprises.
export const toPaise = (value) => {
  const [whole, frac = ""] = String(value).split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
export const formatPaise = (paise) => inr.format(paise / 100);
export const formatINR = (value) => inr.format(Number(value));

// Preview only. The server recalculates everything.
export function calcTotals(cart) {
  const subtotal = cart.reduce((sum, i) => sum + toPaise(i.price) * i.quantity, 0);
  const tax = Math.floor((subtotal * TAX_RATE + 50) / 100);
  return { subtotal, tax, total: subtotal + tax };
}
