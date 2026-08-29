import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Parses a request body against a zod schema. Returns `{ data }` on success;
 * on failure returns `{ response }` — a ready-to-return 400 with the first
 * validation issue — so callers can `if ("response" in result) return
 * result.response;` instead of hand-rolling body validation per route.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return {
      response: NextResponse.json(
        { error: `${path}${issue?.message ?? "Invalid request body"}` },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
