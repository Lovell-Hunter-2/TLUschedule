import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseScheduleText(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích văn bản lịch học hoặc lịch thi sau đây và trả về một danh sách các môn học dưới dạng JSON.
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
    
    LƯU Ý QUAN TRỌNG ĐỐI VỚI LỊCH THI:
    Nếu văn bản có dấu hiệu là lịch thi (chứa các từ như 'lịch thi', 'lichjthi', 'số báo danh', 'phòng thi', 'ca thi', 'ngày thi', 'tên đợt thi', v.v.):
    1. Trường "name" (Tên môn học) PHẢI có tiền tố "Lịch Thi: ", ví dụ: "Lịch Thi: Cơ sở lập trình Kinh tế số".
    2. Lấy "Số báo danh" (SBD) và điền vào trường "lecturer" theo định dạng "SBD: [số báo danh]" (ví dụ: "SBD: 57").
    3. "startDate" và "endDate" là cùng một ngày (chính là ngày thi).
    4. "daysOfWeek" là thứ của ngày thi đó.
    5. "periods" là các tiết tương ứng với ca thi (ví dụ: Ca thi 11-12 thì ghi [11, 12]).
    
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
