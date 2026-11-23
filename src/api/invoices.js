import { request } from "./client";

export const createInvoice = (payload) =>
  request("/invoices", { method: "POST", body: JSON.stringify(payload) });

export const getInvoices = ({
  page = 1,
  limit = 10,
  search = "",
  from = "",
  to = "",
} = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set("search", search);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/invoices?${params}`);
};

export const getInvoice = (number) =>
  request(`/invoices/${encodeURIComponent(number)}`);