// 파일 경로: api/chat.js

export default async function handler(req, res) {
  // POST 요청이 아니면 거부
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const userInput = req.body; // 프론트엔드에서 보낸 대화 내용

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // process.env.OPENAI_API_KEY는 Vercel/Netlify에 설정한 환경변수를 가리킵니다.
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` 
      },
      body: JSON.stringify(userInput) // 프론트에서 받은 내용을 그대로 전달
    });

    const data = await response.json();
    
    // 결과를 프론트엔드로 다시 전송
    res.status(200).json(data);

  } catch (error) {
    console.error('API 호출 중 오류:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
