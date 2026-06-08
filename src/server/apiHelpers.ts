import { NextApiRequest, NextApiResponse } from "next";
import { ZodError } from "zod";

export const parseRequestBody = (req: NextApiRequest) => {
  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }

  return req.body ?? {};
};

export const methodNotAllowed = (res: NextApiResponse, methods: string[]) => {
  res.setHeader("Allow", methods);
  res.status(405).json({ error: `Method not allowed. Use: ${methods.join(", ")}` });
};

export const handleApiError = (res: NextApiResponse, error: unknown) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      issues: error.issues.map(issue => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  console.error(error);
  return res.status(500).json({ error: "Unexpected server error" });
};
