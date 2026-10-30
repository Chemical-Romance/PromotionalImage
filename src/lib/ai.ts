/**
 * AI API 客户端 —— 前端统一请求同源 /api/ai/chat/completions，
 * 真正的 API Key 由服务器端 Node 代理注入。
 * 这样 Key 永不暴露到浏览器，用户无需手动配置。
 */

export interface AISlideSuggestion {
  title: string;
  subtitle: string;
}

export interface AISuggestion {
  theme: string;
  primaryColor?: string;
  deviceHint?: string;
  bgHint?: string;
  slides: AISlideSuggestion[];
}

/**
 * 调用多模态 LLM 分析一组截图，返回标题副标题建议。
 * @param userPrompt 用户的需求描述（自然语言）
 * @param screenshots 截图 data URL 数组
 * @param signal 可选的 AbortSignal
 */
export async function analyzeScreenshots(
  userPrompt: string,
  screenshots: { dataUrl: string; filename?: string }[],
  signal?: AbortSignal,
): Promise<AISuggestion> {
  const systemPrompt = `你是一位专业的 App Store 宣传图文案策划。
用户会给你一个产品主题描述和若干张应用截图。
请根据每张截图的内容，为它写一句标题和一句副标题。
要求：
- 标题 4~12 个汉字，有吸引力，能概括画面核心功能
- 副标题 8~20 个汉字，补充说明或制造情绪
- 保持中文输出
- 如果截图有文字，请理解其含义再写文案，不要直接照搬截图里的按钮文字
- primaryColor 字段：优先从用户的主题描述里提取颜色关键词（如"红色"、"蓝色"、"#FF0000"），转换成标准 HEX 格式返回；如果用户没提颜色，再根据截图的主色调推断；都没有才返回 null
- deviceHint 字段：根据截图里应用的界面形态判断是 phone/tablet/desktop，不确定返回 null
- 返回严格的 JSON，不要加任何解释：
{"theme": "主题摘要 10~20 字", "primaryColor": "#RRGGBB 或 null", "deviceHint": "phone/tablet/desktop/null", "bgHint": "可选的背景风格描述", "slides": [{"title": "...", "subtitle": "..."}, ...]}
slides 数组长度必须与上传的截图数量一致，一一对应。`;

  const userContent: any[] = [{ type: 'text', text: userPrompt || '请分析这些应用截图' }];
  for (const shot of screenshots) {
    userContent.push({
      type: 'image_url',
      image_url: { url: shot.dataUrl },
    });
  }

  const resp = await fetch('/api/ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let msg = `AI 调用失败 (${resp.status})`;
    try {
      const j = JSON.parse(text);
      if (j?.error?.message) msg += `: ${j.error.message}`;
      else if (j?.message) msg += `: ${j.message}`;
      else if (text) msg += `: ${text.slice(0, 200)}`;
    } catch {
      if (text) msg += `: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('AI 未返回内容');

  let parsed: any;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 返回内容无法解析');
    parsed = JSON.parse(m[0]);
  }

  const slides: AISlideSuggestion[] = Array.isArray(parsed.slides)
    ? parsed.slides.slice(0, screenshots.length).map((s: any) => ({
        title: String(s?.title ?? '').trim(),
        subtitle: String(s?.subtitle ?? '').trim(),
      }))
    : [];

  while (slides.length < screenshots.length) {
    slides.push({ title: `第 ${slides.length + 1} 张截图`, subtitle: '' });
  }

  return {
    theme: String(parsed.theme ?? '').trim() || '应用宣传图',
    primaryColor: typeof parsed.primaryColor === 'string' ? parsed.primaryColor : undefined,
    deviceHint: typeof parsed.deviceHint === 'string' ? parsed.deviceHint : undefined,
    bgHint: typeof parsed.bgHint === 'string' ? parsed.bgHint : undefined,
    slides,
  };
}

/** 测试 AI 代理是否可用 */
export async function testAIProxy(signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
  try {
    const resp = await fetch('/api/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: '回复 OK 即可' }],
        max_tokens: 10,
      }),
      signal,
    });
    if (resp.ok) return { ok: true, message: '连接成功' };
    const text = await resp.text().catch(() => '');
    return { ok: false, message: `${resp.status}: ${text || resp.statusText}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || '网络错误' };
  }
}
