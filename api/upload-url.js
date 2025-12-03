import { put } from "@vercel/blob";

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: "Missing filename or contentType" });
    }

    // Upload directly to Vercel Blob storage
    const blob = await put(filename, req, {
      access: "public",          // Makes uploaded file viewable via public URL
      contentType,               // Keeps correct MIME type
      addRandomSuffix: true,     // Prevents duplicate filename errors
    });

    console.log("✅ Upload successful:", blob.url);

    // Respond with JSON including the new file URL
    return res.status(200).json({
      success: true,
      url: blob.url,
      message: "Upload successful",
    });
  } catch (err) {
    console.error("❌ Upload URL error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to create upload URL",
      details: err.message,
    });
  }
}
