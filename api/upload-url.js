import { put } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filename, contentType } = req.body;

    const blob = await put(filename, req, {
      access: "public",
      contentType,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("Upload URL error:", err);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
}
