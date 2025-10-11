// 이 파일은 AI 요청을 대신 처리해주는 '중개 서버' 역할을 합니다.
// API 키는 Netlify 사이트에 안전하게 보관되고, 이 파일 안에서는 process.env.GEMINI_API_KEY 형태로 불러옵니다.

exports.handler = async function (event, context) {
  // 클라이언트(브라우저)에서 보낸 데이터를 받습니다.
  const { question, studentAnswer } = JSON.parse(event.body);
  
  // Netlify에 저장된 API 키를 안전하게 불러옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const rubricString = Array.isArray(question.rubric) ? question.rubric.map(r => `- ${r.criterion} (${r.maxScore}점)`).join('\n') : '채점 기준 없음';
  
  const systemPrompt = "당신은 학생들의 서술형 답안을 채점하고 건설적인 피드백을 제공하는 유능하고 친절한 AI 선생님입니다. 제시된 채점 기준(루브릭)에 따라 학생의 답변을 엄격하고 객관적으로 평가해주세요. 학생이 더 발전할 수 있도록 긍정적이고 구체적인 조언을 담아 피드백을 작성해야 합니다.";

  const userQuery = `다음은 학생이 서술형 문제에 대해 제출한 답변입니다. 채점 기준에 따라 각 항목별 점수를 매기고, 종합 피드백을 작성해주세요.
  
  ### 문제
  ${question.questionText}

  ### 학생 답변
  ${studentAnswer}

  ### 채점 기준 (루브릭)
  ${rubricString}

  ### 출력 형식
  반드시 아래 JSON 형식에 맞춰서, 각 채점 기준 항목마다 점수를 할당하고, 종합 피드백을 한국어로 작성해주세요. 점수는 최대 점수를 초과할 수 없습니다.`;

  const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
              type: "OBJECT",
              properties: {
                  scores: {
                      type: "ARRAY",
                      items: {
                          type: "OBJECT",
                          properties: { criterion: { type: "STRING" }, score: { type: "NUMBER" } },
                          required: ["criterion", "score"]
                      }
                  },
                  feedback: { type: "STRING" }
              },
              required: ["scores", "feedback"]
          }
      }
  };

  try {
    const response = await fetch(apiUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("AI 피드백 생성 오류:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI 피드백 생성 중 오류가 발생했습니다." }),
    };
  }
};
