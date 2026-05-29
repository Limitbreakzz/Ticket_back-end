const isDiscordWebhook = (url) => /discord(?:app)?\.com\/api\/webhooks/.test(url);
const isTeamsWebhook = (url) => /outlook\.office\.com\/webhook/.test(url);
const isSlackWebhook = (url) => /hooks\.slack\.com\/services/.test(url);

const DEFAULT_DISCORD_AUTHOR_ICON = "https://api.dicebear.com/7.x/bottts/png?seed=ITSupport";

const getEventColor = (event) => {
  switch (event) {
    case "TICKET_CREATED":
      return 0x10b981; // emerald
    case "TICKET_ASSIGNED":
      return 0x3b82f6; // blue
    case "TICKET_STATUS_UPDATED":
      return 0xf59e0b; // amber
    case "TICKET_COMMENT_ADDED":
      return 0x818cf8; // indigo
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
    // Beautiful dynamic slate placeholder clearly showing "No Image Attached"
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

      // Check if we have a base64 image in imageUrl
      const base64Regex = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/;
      if (payload.imageUrl && base64Regex.test(payload.imageUrl)) {
        const match = payload.imageUrl.match(base64Regex);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, "base64");

          // Map extension
          let ext = "png";
          if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
          else if (mimeType.includes("gif")) ext = "gif";
          else if (mimeType.includes("webp")) ext = "webp";

          const fileName = `ticket_image.${ext}`;

          // Reference attachment in the embed
          if (discordBody.embeds && discordBody.embeds[0]) {
            discordBody.embeds[0].image = { url: `attachment://${fileName}` };
            // Remove thumbnail if we have an image so it is displayed as a nice large preview image
            delete discordBody.embeds[0].thumbnail;
          }

          const formData = new FormData();
          formData.append("payload_json", JSON.stringify(discordBody));

          const blob = new Blob([buffer], { type: mimeType });
          formData.append("files[0]", blob, fileName);

          body = formData;
          isMultipart = true;
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

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(`Webhook dispatch failed: ${response.status} ${response.statusText} - ${responseText}`);

      if (isDiscordWebhook(url)) {
        const fallbackBody = buildDiscordFallbackBody(payload);
        const fallbackHeaders = { "Content-Type": "application/json" };
        const fallbackResponse = await fetch(url, {
          method: "POST",
          headers: fallbackHeaders,
          body: JSON.stringify(fallbackBody),
        });
        if (!fallbackResponse.ok) {
          const fallbackText = await fallbackResponse.text().catch(() => "");
          console.error(`Discord webhook fallback failed: ${fallbackResponse.status} ${fallbackResponse.statusText} - ${fallbackText}`);
        }
      }
    }
  } catch (err) {
    console.error(`Webhook dispatch error for URL ${url}:`, err);
  }
}

module.exports = {
  dispatchWebhook
};
