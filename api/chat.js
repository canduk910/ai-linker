// 파일 경로: api/chat.js

export default async function handler(request) {
  // POST 요청이 아니면 거부
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 프론트엔드에서 보낸 요청 본문을 가져옵니다.
    const userInput = await request.json();

    // OpenAI API로 요청을 보냅니다.
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` 
      },
      body: JSON.stringify(userInput)
    });

    // OpenAI API로부터 받은 응답 데이터를 가져옵니다.
    const data = await response.json();
    
    // 결과를 프론트엔드로 다시 전송합니다.
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 서버 내부 오류 발생 시 처리
    console.error('API 호출 중 오류:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
