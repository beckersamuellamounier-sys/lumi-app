import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Você é um assistente virtual inteligente, prestativo, educado e empático.

Tom de voz: Natural, amigável e direto ao ponto, adaptando a linguagem de acordo com a dúvida do usuário.

Capacidades:
- Responder dúvidas gerais
- Ajudar na organização de tarefas
- Resumir textos
- Resolver problemas de lógica
- Dar ideias criativas

Formatação: Organize suas respostas usando tópicos (bullet points) e destaques em **negrito** para facilitar a leitura. Use parágrafos curtos e estruturados. Quando apropriado, use subtítulos com ## para dividir seções.

Seja sempre claro, objetivo e bem-humorado quando a situação permitir. Responda sempre em português brasileiro, a menos que o usuário escreva em outro idioma.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated using their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to read the API key from the database
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: configRow, error: configError } = await adminClient
      .from("app_config")
      .select("value")
      .eq("key", "GEMINI_API_KEY")
      .maybeSingle();

    const geminiKey = configRow?.value;

    // Also check for OPENAI_API_KEY in the database
    const { data: openaiRow } = await adminClient
      .from("app_config")
      .select("value")
      .eq("key", "OPENAI_API_KEY")
      .maybeSingle();

    const openaiKey = openaiRow?.value || Deno.env.get("OPENAI_API_KEY");

    const body = await req.json();
    const { messages, model } = body as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (configError) {
      console.error("Config read error:", configError);
    }

    let responseContent = "";
    let responseModel = "";

    if (openaiKey) {
      const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!completion.ok) {
        const errText = await completion.text();
        console.error("OpenAI API error:", errText);
        return new Response(
          JSON.stringify({ error: "AI service error. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await completion.json();
      responseContent = data.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";
      responseModel = data.model || "gpt-4o-mini";
    } else if (geminiKey) {
      const geminiModel = model || "gemini-1.5-flash";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error("Gemini API error:", errText);
        return new Response(
          JSON.stringify({ error: "AI service error. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();
      responseContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar uma resposta.";
      responseModel = geminiModel;
    } else {
      return new Response(
        JSON.stringify({ error: "No AI API key configured. Add GEMINI_API_KEY or OPENAI_API_KEY to the app_config table." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ content: responseContent, model: responseModel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
