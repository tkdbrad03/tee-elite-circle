import { put } from "@vercel/blob";

export const config = { 
  api: { 
    bodyParser: false,
    responseLimit: false
  } 
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    
    // Handle multipart form data (for larger files)
    if (contentType.includes("multipart/form-data")) {
      // Parse multipart form data
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Extract boundary from content-type
      const boundary = contentType.split("boundary=")[1];
      if (!boundary) {
        return res.status(400).json({ error: "Invalid multipart data" });
      }
      
      // Parse the multipart data to get file
      const parts = buffer.toString('binary').split(`--${boundary}`);
      const filePart = parts.find(part => part.includes('Content-Type:'));
      
      if (!filePart) {
        return res.status(400).json({ error: "No file in upload" });
      }
      
      // Extract filename and file content
      const nameMatch = filePart.match(/filename="(.+?)"/);
      const filename = nameMatch ? nameMatch[1] : `upload-${Date.now()}`;
      
      // Get the actual file content (after the double CRLF)
      const fileContentStart = filePart.indexOf('\r\n\r\n') + 4;
      const fileContentEnd = filePart.lastIndexOf('\r\n');
      const fileContent = Buffer.from(filePart.substring(fileContentStart, fileContentEnd), 'binary');
      
      // Get file mime type
      const typeMatch = filePart.match(/Content-Type: (.+?)\r\n/);
      const mimeType = typeMatch ? typeMatch[1] : "application/octet-stream";
      
      // Upload to Vercel Blob
      const blob = await put(filename, fileContent, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix: true,
      });
      
      console.log("✅ Upload successful (multipart):", blob.url);
      return res.status(200).json({ success: true, url: blob.url });
    } 
    
    // Handle direct stream (original method for smaller files)
    else {
      const filename = decodeURIComponent(req.headers["x-filename"] || `upload-${Date.now()}`);
      const blob = await put(filename, req, {
        access: "public",
        contentType: contentType || "application/octet-stream",
        addRandomSuffix: true,
      });
      
      console.log("✅ Upload successful (stream):", blob.url);
      return res.status(200).json({ success: true, url: blob.url });
    }
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
