import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseScheduleText(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích văn bản lịch học sau đây và trả về một danh sách các môn học dưới dạng JSON.
    Văn bản: "${text}"
    
    Yêu cầu định dạng JSON:
    [
      {
        "name": "Tên môn học",
        "room": "Phòng học",
        "lecturer": "Giảng viên",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "daysOfWeek": [2, 5], // Thứ 2 là 1, Thứ 3 là 2, ..., Chủ nhật là 0. Chú ý: Trong JavaScript Date, 0 là Chủ Nhật, 1 là Thứ 2. Hãy chuyển đổi cho đúng: Thứ 2 -> 1, ..., Thứ 7 -> 6, Chủ Nhật -> 0.
        "periods": [1, 2, 3] // Các tiết học (1-15)
      }
    ]
    
    Nếu không tìm thấy thông tin nào, hãy trả về mảng rỗng.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            room: { type: Type.STRING },
            lecturer: { type: Type.STRING },
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            daysOfWeek: { 
              type: Type.ARRAY,
              items: { type: Type.INTEGER }
            },
            periods: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER }
            }
          },
          required: ["name", "startDate", "endDate", "daysOfWeek", "periods"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
