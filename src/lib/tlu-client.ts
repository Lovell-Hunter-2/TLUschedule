export async function syncTluWithChunks(bodyParams: any, idToken?: string) {
   let json = { data: [], exams: [], gpaSummary: [], detailedMarks: [], studentName: '', encryptedPassword: '' };
   
   const headers: any = { 'Content-Type': 'application/json' };
   if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
   }

   const doSync = async (target: string, extraBody: any = {}) => {
      const r = await fetch('/api/tlu-sync', {
         method: 'POST',
         headers,
         body: JSON.stringify({ ...bodyParams, ...extraBody, syncTarget: target })
      });
      let data;
      try {
         data = await r.json();
      } catch (e) {
         throw new Error(`Máy chủ Vercel phản hồi lỗi (Status: ${r.status}). Vui lòng thử lại.`);
      }
      if (!r.ok) {
         let errorMsg = data?.error || 'Lỗi đăng nhập hoặc đồng bộ';
         if (data?.details) {
            const detailStr = typeof data.details === 'string' ? data.details.substring(0, 500) : JSON.stringify(data.details);
            errorMsg += `\nChi tiết: ${detailStr}`;
         }
         throw new Error(errorMsg);
      }
      return data;
   };

   // 0. Login & Get TLU Token
   const loginRes = await doSync('login');
   const tluToken = loginRes.tluToken;
   if (loginRes.encryptedPassword) json.encryptedPassword = loginRes.encryptedPassword;

   // 1. Fetch Marks & Info
   const marksRes = await doSync('marks', { tluToken });
   json.gpaSummary = marksRes.gpaSummary || [];
   json.detailedMarks = marksRes.detailedMarks || [];
   json.studentName = marksRes.studentName || '';

   // 2. Fetch Schedules
   const schedRes = await doSync('schedules', { tluToken });
   json.data = schedRes.data || [];

   // 3. Fetch Exams
   try {
      const examsRes = await doSync('exams', { tluToken });
      json.exams = examsRes.exams || [];
   } catch (e) {
      // If exams fail, we can just ignore it to avoid destroying everything
      console.error("Exams sync failed", e);
   }

   return { res: { ok: true, json: async () => json }, json };
}
