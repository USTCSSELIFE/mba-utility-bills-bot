import config from "./config.json";

const bot_token = config["bot_token"];
const bot_name = config["bot_name"];
const master_id = config["master_id"];
const chat_id = config["chat_id"];
const shiroJID = config["shiroJID"];
let room_code = config["room_code"];
if (room_code.length === 3) {
  room_code = "010" + room_code;
} else {
  room_code = "01" + room_code;
}
const floor_code = room_code.substring(0, 4);

const base_url = "https://application.xiaofubao.com/app/electric";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

addEventListener("scheduled", (event) => {
  event.waitUntil(handleCronRequest(event));
});

async function handleRequest(request) {
  if (request.method === "POST") {
    let data = await request.json();
    let chat_id = data.message.chat.id;
    let text = data.message.text || "";
    let texts = text.split(" ");
    if (text[0] === "/") {
      texts[0] = texts[0].replace("/", "").replace(bot_name, "");
      switch (texts[0]) {
        case "start":
          await tg(bot_token, "sendMessage", {
            chat_id: chat_id,
            text: "查询水电费。",
          });
          break;
        case "check":
          let formData = new FormData();
          formData.append("areaId", "2111390708982824961");
          formData.append("buildingCode", "01");
          formData.append("floorCode", floor_code);
          formData.append("roomCode", room_code);
          let data = await (
            await fetch(`${base_url}/queryISIMSRoomSurplus`, {
              method: "POST",
              headers: {
                Cookie: `shiroJID=${shiroJID}`,
              },
              body: formData,
            })
          ).json();
          if (data["success"] === true) {
            await tg(bot_token, "sendMessage", {
              chat_id: chat_id,
              text: `剩余电费：${data["data"]["totalSocAmount"]} 元，剩余水费：${data["data"]["totalWaterAmount"]} 元`,
            });
          } else {
            await tg(bot_token, "sendMessage", {
              chat_id: chat_id,
              text: "查询错误：" + data["message"],
            });
          }
          break;
      }
    }
  }

  return new Response("ok", { status: 200 });
}

async function handleCronRequest(event) {
  switch (event.cron) {
    case "5 16 * * *":
      await NotifyLastDayUtilityBills();
      break;
  }
}

async function tg(token, type, data) {
  let response = await (
    await fetch(`https://api.telegram.org/bot${token}/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  ).json();
  if (!response.ok) {
    await tg(bot_token, "sendMessage", {
      chat_id: master_id,
      text: JSON.stringify(response),
    });
  }
}

async function NotifyLastDayUtilityBills() {
  let socFormData = new FormData();
  socFormData.append("areaId", "2111390708982824961");
  socFormData.append("buildingCode", "01");
  socFormData.append("floorCode", floor_code);
  socFormData.append("roomCode", room_code);
  socFormData.append("mdtype", "1153");
  let socData = await (
    await fetch(`${base_url}/getISIMSRecords`, {
      method: "POST",
      headers: {
        Cookie: `shiroJID=${shiroJID}`,
      },
      body: socFormData,
    })
  ).json();

  let waterFormData = new FormData();
  waterFormData.append("areaId", "2111390708982824961");
  waterFormData.append("buildingCode", "01");
  waterFormData.append("floorCode", floor_code);
  waterFormData.append("roomCode", room_code);
  waterFormData.append("mdtype", "1472");
  let waterData = await (
    await fetch(`${base_url}/getISIMSRecords`, {
      method: "POST",
      headers: {
        Cookie: `shiroJID=${shiroJID}`,
      },
      body: waterFormData,
    })
  ).json();

  if (socData["success"] === true && waterData["success"] === true) {
    await tg(bot_token, "sendMessage", {
      chat_id: chat_id,
      text: `昨天电费：${socData["rows"][0]["used"]} 元，水费：${waterData["rows"][0]["used"]} 元`,
    });
  } else {
    await tg(bot_token, "sendMessage", {
      chat_id: chat_id,
      text: `查询请求错误：${socData["message"]}，${waterData["message"]}`,
    });
  }
}
