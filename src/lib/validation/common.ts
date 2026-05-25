import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export function parsePagination(searchParams: URLSearchParams) {
  return paginationSchema.parse(Object.fromEntries(searchParams));
}
