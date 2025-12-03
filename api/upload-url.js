import { put } from "@vercel/blob";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: "Missing filename or contentType" });
    }

    // Upload the file directly to Vercel Blob storage
    const blob = await put(filename, req, {
      access: "public",         // makes the file publicly accessible
      contentType,              // preserves correct MIME type
      addRandomSuffix: true     // prevents "already exists" upload errors
    });

    console.log("✅ Upload successful:", blob.url);

    // Return the final file URL to your frontend
    return res.status(200).json({ url: blob.url });

  } catch (err) {
    console.error("❌ Upload URL error:", err);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
}
