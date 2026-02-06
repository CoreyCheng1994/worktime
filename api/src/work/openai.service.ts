import { BadRequestException, Injectable } from "@nestjs/common";

interface ParsedItem {
  text: string;
  status: 0 | 2;
}

interface ParsedResult {
  items: ParsedItem[];
  summary?: string;
}

@Injectable()
export class OpenAiService {

  async parseWorkItems(input: string): Promise<ParsedResult> {
    if (typeof input !== "string" || input.trim() === "") {
      throw new BadRequestException("input 不能为空");
    }

    const aiUrl = process.env.AI_URL;
    if (!aiUrl) {
      throw new BadRequestException("缺少 AI_URL");
    }
    const apiKey = process.env.AI_KEY;
    if (!apiKey) {
      throw new BadRequestException("缺少 AI_KEY");
    }

    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const systemPrompt =
      "你是工作记录助手。将用户自然语言拆解成清晰的工作项，仅输出 JSON。";
    const userPrompt =
      "请把下面内容拆解为可执行的工作项列表。\n" +
      "要求：\n" +
      "1) items 为数组；每个 item 包含 text 与 status\n" +
      "2) status 只能是 0 或 2（0=未完成，2=完成），文本项不允许 1\n" +
      "3) text 为简明动作短语，不要编号\n" +
      "4) 如未明确完成状态，默认 status=0\n" +
      "5) 可以返回 summary 作为总体概述（可选）\n\n" +
      `内容：${input.trim()}`;

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "work_items",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      text: { type: "string" },
                      status: { type: "integer", enum: [0, 2] }
                    },
                    required: ["text", "status"]
                  }
                }
              },
              required: ["items"]
            }
          }
        }
      })
    });
    if (!response.ok) {
      const message = await response.text();
      throw new BadRequestException(`OpenAI 请求失败: ${message}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadRequestException("OpenAI 返回为空");
    }

    let parsed: ParsedResult;
    try {
      parsed = JSON.parse(content) as ParsedResult;
    } catch (error) {
      throw new BadRequestException("OpenAI 返回无法解析为 JSON");
    }

    if (!Array.isArray(parsed.items)) {
      throw new BadRequestException("OpenAI 返回 items 格式错误");
    }

    parsed.items = parsed.items
      .filter((item) => item && typeof item.text === "string")
      .map((item) => ({
        text: item.text.trim(),
        status: (item.status === 2 ? 2 : 0) as 0 | 2
      }))
      .filter((item) => item.text.length > 0);

    return parsed;
  }
}
