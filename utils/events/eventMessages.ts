export type EventMessageTone = "birthday" | "memorial" | "condolence" | "wedding" | "anniversary" | "custom";

export type EventMessageInput = {
  type: string;
  personName?: string | null;
  daysUntil?: number | null;
  yearsInfo?: string | null;
  eventDateLabel?: string | null;
  location?: string | null;
  content?: string | null;
};

export type EventMessage = {
  emoji: string;
  label: string;
  title: string;
  message: string;
  tone: EventMessageTone;
};

function safeName(value?: string | null, fallback = "sự kiện gia đình") {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function isToday(daysUntil?: number | null) {
  return daysUntil === 0;
}


export function shouldNotifyEventType(type: string) {
  // Ngày mất là dữ liệu lịch sử. Nhắc hằng năm phải dùng death_anniversary.
  return type !== "death" && type !== "death_recent";
}

function daysLabel(daysUntil?: number | null) {
  if (daysUntil == null) return "";
  if (daysUntil === 0) return "hôm nay";
  if (daysUntil === 1) return "ngày mai";
  if (daysUntil > 1) return `còn ${daysUntil} ngày nữa`;
  if (daysUntil === -1) return "hôm qua";
  return `${Math.abs(daysUntil)} ngày trước`;
}

export function buildEventMessage(input: EventMessageInput): EventMessage {
  const name = safeName(input.personName);
  const when = daysLabel(input.daysUntil);

  switch (input.type) {
    case "birthday":
      return {
        emoji: "🎂",
        label: "Sinh nhật",
        title: isToday(input.daysUntil)
          ? `Hôm nay là sinh nhật ${name}`
          : `Sắp đến sinh nhật ${name}`,
        message: isToday(input.daysUntil)
          ? `Chúc ${name} luôn mạnh khỏe, bình an, hạnh phúc và gặp nhiều may mắn.`
          : `${name} có sinh nhật ${when}. Chuẩn bị gửi một lời chúc thật ấm áp cho ngày đặc biệt này.`,
        tone: "birthday",
      };

    case "death_recent":
    case "death":
      return {
        emoji: "🕯️",
        label: "Ngày mất",
        title: `Ngày mất của ${name}`,
        message:
          "Ngày mất chỉ là dữ liệu lịch sử trong hồ sơ. Hệ thống không dùng ngày mất để nhắc sự kiện; ngày nhắc hằng năm phải là Ngày giỗ.",
        tone: "memorial",
      };

    case "death_anniversary":
      return {
        emoji: "🕯️",
        label: "Ngày giỗ",
        title: isToday(input.daysUntil)
          ? `Hôm nay là ngày giỗ của ${name}`
          : `Sắp đến ngày giỗ của ${name}`,
        message: isToday(input.daysUntil)
          ? `Kính nhớ và tưởng niệm ${name}. Mong con cháu luôn ghi nhớ công ơn người đi trước.`
          : `Ngày giỗ của ${name} ${when}. Gia đình có thể chuẩn bị hương hoa và cùng nhau tưởng nhớ.`,
        tone: "memorial",
      };

    case "marriage_upcoming":
      return {
        emoji: "💐",
        label: "Đám cưới",
        title: isToday(input.daysUntil)
          ? `Hôm nay là ngày cưới của ${name}`
          : `Sắp đến đám cưới của ${name}`,
        message: isToday(input.daysUntil)
          ? `Chúc hai người trăm năm hạnh phúc, thuận hòa, yêu thương và luôn đồng hành bên nhau.`
          : `Đám cưới của ${name} ${when}. ${input.location ? `Địa điểm: ${input.location}.` : "Gia đình cùng chuẩn bị lời chúc mừng thật ý nghĩa."}`,
        tone: "wedding",
      };

    case "marriage_anniversary":
      return {
        emoji: "💍",
        label: "Kỷ niệm cưới",
        title: isToday(input.daysUntil)
          ? `Hôm nay là kỷ niệm ngày cưới của ${name}`
          : `Sắp đến kỷ niệm ngày cưới của ${name}`,
        message: isToday(input.daysUntil)
          ? `Chúc hai người luôn yêu thương, cảm thông, gìn giữ hạnh phúc và cùng nhau đi qua mọi chặng đường.`
          : `Kỷ niệm ngày cưới của ${name} ${when}. Đây là dịp đẹp để gửi lời chúc bình an và hạnh phúc.`,
        tone: "anniversary",
      };

    case "custom_event":
    case "custom":
    default:
      return {
        emoji: "📌",
        label: "Sự kiện",
        title: isToday(input.daysUntil)
          ? `Hôm nay có sự kiện: ${name}`
          : `Sắp đến sự kiện: ${name}`,
        message: input.content?.trim() ||
          (when ? `Sự kiện ${when}. ${input.location ? `Địa điểm: ${input.location}.` : ""}` : "Sự kiện gia đình cần lưu ý."),
        tone: "custom",
      };
  }
}
