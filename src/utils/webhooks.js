const isDiscordWebhook = (url) => /discord(?:app)?\.com\/api\/webhooks/.test(url);
const isTeamsWebhook = (url) => /outlook\.office\.com\/webhook/.test(url);
const isSlackWebhook = (url) => /hooks\.slack\.com\/services/.test(url);

const DEFAULT_DISCORD_AUTHOR_ICON = "https://api.dicebear.com/7.x/bottts/png?seed=ITSupport";

const getEventColor = (event) => {
  switch (event) {
    case "TICKET_CREATED":
      return 0x10b981;
    case "TICKET_ASSIGNED":
      return 0x3b82f6;
    case "TICKET_STATUS_UPDATED":
      return 0xf59e0b;
    case "TICKET_COMMENT_ADDED":
      return 0x818cf8;
    default:
      return 0x4F46E5;
  }
};

const buildDiscordEmbed = (payload) => {
  let authorName = "📢 Ticket Hub Notification";
  switch (payload.event) {
    case "TICKET_CREATED":
      authorName = "🆕 Ticket แจ้งเรื่อง/คำขอใหม่";
      break;
    case "TICKET_ASSIGNED":
      authorName = "🔧 เจ้าหน้าที่รับดูแลเคสแล้ว";
      break;
    case "TICKET_UNASSIGNED":
      authorName = "🔄 ยกเลิกผู้ดูแล Ticket";
      break;
    case "TICKET_STATUS_UPDATED":
      authorName = "🔄 อัปเดตสถานะ Ticket";
      break;
    case "TICKET_COMMENT_ADDED":
      authorName = "💬 ข้อความตอบกลับใหม่";
      break;
    case "TICKET_TRANSFERRED":
      authorName = "🔄 ส่งต่อ Ticket ไปยังแผนกอื่น";
      break;
  }

  const embed = {
    type: "rich",
    title: payload.title || payload.event,
    description: payload.description || payload.text || "",
    color: payload.color ?? getEventColor(payload.event),
    author: {
      name: authorName,
      icon_url: payload.iconUrl || DEFAULT_DISCORD_AUTHOR_ICON,
    },
    footer: {
      text: payload.footerText || "Ticket Hub — ระบบส่งและจัดการ Ticket",
      icon_url: payload.footerIconUrl || payload.iconUrl || DEFAULT_DISCORD_AUTHOR_ICON,
    },
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  if (payload.fields?.length) {
    embed.fields = payload.fields;
  }

  if (payload.imageUrl) {
    embed.image = { url: payload.imageUrl };
  } else {
    // Fallback placeholder when no attachment is present
    embed.image = { url: "https://placehold.co/600x120/090d16/475569/png?text=%F0%9F%93%B7%20No%20Image%20Attached" };
  }

  return embed;
};

const buildDiscordBody = (payload) => {
  const body = {
    username: "Ticket Hub",
    avatar_url: DEFAULT_DISCORD_AUTHOR_ICON,
    embeds: [buildDiscordEmbed(payload)],
  };

  if (typeof payload.content === "string") {
    body.content = payload.content;
  }

  return body;
};

const buildDiscordFallbackBody = (payload) => {
  return {
    username: "Ticket Hub",
    avatar_url: DEFAULT_DISCORD_AUTHOR_ICON,
    content: payload.text || payload.description || payload.title || payload.event,
  };
};

async function dispatchWebhook(url, payload) {
  let body = undefined;
  let isMultipart = false;
  const headers = {};

  try {
    if (isDiscordWebhook(url)) {
      const discordBody = buildDiscordBody(payload);

      // Handle image data for Discord attachments (supports multiple comma-separated URLs)
      const base64Regex = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/;
      const attachmentFiles = [];
      const directImageUrls = [];

      if (payload.imageUrl) {
        const urlList = typeof payload.imageUrl === 'string' && payload.imageUrl.includes(',')
          ? payload.imageUrl.split(',').map(s => s.trim()).filter(Boolean)
          : [payload.imageUrl];

        const fs = require('fs');
        const path = require('path');

        urlList.forEach((imgUrl, idx) => {
          let attachmentBuffer = null;
          let attachmentFileName = null;
          let attachmentMimeType = null;

          if (base64Regex.test(imgUrl)) {
            const match = imgUrl.match(base64Regex);
            if (match) {
              attachmentMimeType = match[1];
              const base64Data = match[2];
              attachmentBuffer = Buffer.from(base64Data, "base64");
              
              let ext = "png";
              if (attachmentMimeType.includes("jpeg") || attachmentMimeType.includes("jpg")) ext = "jpg";
              else if (attachmentMimeType.includes("gif")) ext = "gif";
              else if (attachmentMimeType.includes("webp")) ext = "webp";

              attachmentFileName = `ticket_image_${idx + 1}.${ext}`;
            }
          } else if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
            // Online hosted URL (Cloudinary / S3 / External Server)
            directImageUrls.push(imgUrl);
          } else {
            // Check if it's a local server image URL
            const imagesMatch = imgUrl.match(/\/images\/([^/]+)$/);
            if (imagesMatch) {
              const filename = decodeURIComponent(imagesMatch[1]);
              const filePath = path.join(__dirname, '../../images', filename);
              if (fs.existsSync(filePath)) {
                attachmentBuffer = fs.readFileSync(filePath);
                attachmentFileName = filename;
                
                const ext = filename.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg'].includes(ext)) attachmentMimeType = 'image/jpeg';
                else if (ext === 'gif') attachmentMimeType = 'image/gif';
                else if (ext === 'webp') attachmentMimeType = 'image/webp';
                else attachmentMimeType = 'image/png';
              }
            }
          }

          if (attachmentBuffer && attachmentFileName && attachmentMimeType) {
            attachmentFiles.push({
              buffer: attachmentBuffer,
              fileName: attachmentFileName,
              mimeType: attachmentMimeType
            });
          }
        });
      }

      if (attachmentFiles.length > 0) {
        // Main embed picture uses the 1st attachment
        if (discordBody.embeds && discordBody.embeds[0]) {
          discordBody.embeds[0].image = { url: `attachment://${attachmentFiles[0].fileName}` };
          delete discordBody.embeds[0].thumbnail;
        }

        const formData = new FormData();
        formData.append("payload_json", JSON.stringify(discordBody));

        attachmentFiles.forEach((fileItem, index) => {
          const blob = new Blob([fileItem.buffer], { type: fileItem.mimeType });
          formData.append(`files[${index}]`, blob, fileItem.fileName);
        });

        body = formData;
        isMultipart = true;
      } else if (directImageUrls.length > 0) {
        // Online image URL (Cloudinary / Public HTTPS URL)
        if (discordBody.embeds && discordBody.embeds[0]) {
          discordBody.embeds[0].image = { url: directImageUrls[0] };
          delete discordBody.embeds[0].thumbnail;
        }
      }

      if (!isMultipart) {
        body = JSON.stringify(discordBody);
        headers["Content-Type"] = "application/json";
      }
    } else if (isTeamsWebhook(url) || isSlackWebhook(url)) {
      body = JSON.stringify({
        text: payload.text || payload.description || payload.title || payload.event,
      });
      headers["Content-Type"] = "application/json";
    } else {
      body = JSON.stringify(payload);
      headers["Content-Type"] = "application/json";
    }

    const attempts = 3;
    let delay = 1000;
    let lastError = null;
    let response = null;

    for (let i = 0; i < attempts; i++) {
      console.log(`[Webhook Debug] Sending payload to ${url} (Attempt ${i + 1}/${attempts})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseText = await response.text().catch(() => "");
        console.log(`[Webhook Debug] Response Status: ${response.status} ${response.statusText}`);
        console.log(`[Webhook Debug] Response Payload: ${responseText}`);

        if (response.ok) {
          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            body: responseText
          };
        } else {
          lastError = new Error(`HTTP ${response.status}: ${responseText}`);
          
          // Discord Fallback on last attempt
          if (i === attempts - 1 && isDiscordWebhook(url)) {
            console.log(`[Webhook Debug] Attempting fallback for Discord webhook...`);
            const fallbackBody = buildDiscordFallbackBody(payload);
            const fallbackResponse = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fallbackBody),
              signal: controller.signal,
            });
            if (fallbackResponse.ok) {
              console.log(`[Webhook Debug] Fallback Discord message sent successfully`);
              return {
                success: true,
                status: fallbackResponse.status,
                statusText: fallbackResponse.statusText,
                body: "Fallback succeeded"
              };
            } else {
              const fallbackText = await fallbackResponse.text().catch(() => "");
              console.error(`[Webhook Debug] Discord fallback failed: ${fallbackResponse.status} - ${fallbackText}`);
            }
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        console.error(`[Webhook Debug] Attempt ${i + 1} error:`, err.message || err);
      }

      if (i < attempts - 1) {
        console.log(`[Webhook Debug] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw lastError || new Error("Webhook dispatch failed after maximum attempts");
  } catch (err) {
    console.error(`[Webhook Debug] Webhook dispatch final error:`, err);
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}

module.exports = {
  dispatchWebhook
};
