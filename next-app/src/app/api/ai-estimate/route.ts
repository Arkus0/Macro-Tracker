import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Eres un nutricionista experto. El usuario te describe una comida en texto libre y tu debes estimar los macronutrientes.

Responde SOLO con un JSON array valido. Cada item debe tener:
- "comida": nombre del alimento (string)
- "gramos": gramos estimados de la porcion (number)
- "kcal": calorias totales de esa porcion (number)
- "proteinas": gramos de proteina (number)
- "carbs": gramos de carbohidratos (number)
- "grasas": gramos de grasa (number)

Si la descripcion menciona varios alimentos, devuelve un item por cada uno.
Usa porciones tipicas espanolas/latinas cuando no se especifique cantidad.
Se conservador en las estimaciones. No inventes datos extremos.

Ejemplo de respuesta:
[{"comida": "Arroz blanco cocido", "gramos": 200, "kcal": 260, "proteinas": 5, "carbs": 58, "grasas": 0.5}]`;

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Descripcion requerida" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Estima los macros de: ${description}`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "Respuesta vacia del modelo" }, { status: 500 });
    }

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo parsear la respuesta" }, { status: 500 });
    }

    const items = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
