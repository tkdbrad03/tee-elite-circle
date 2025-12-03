import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "application/octet-stream";
    const filename = decodeURIComponent(req.headers["x-filename"] || `upload-${Date.now()}`);

    const blob = await put(filename, req, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    console.log("✅ Upload successful:", blob.url);
    res.status(200).json({ success: true, url: blob.url });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
