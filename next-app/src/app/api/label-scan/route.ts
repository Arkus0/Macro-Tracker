import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `Eres un experto en lectura de etiquetas nutricionales. El usuario te envia una foto de una etiqueta nutricional de un producto alimenticio.

Extrae los valores nutricionales POR 100g y responde SOLO con un JSON valido con estos campos:
{
  "nombre_producto": "nombre del producto si es visible",
  "kcal_100g": number,
  "proteinas_100g": number,
  "carbs_100g": number,
  "grasas_100g": number,
  "fibra_100g": number o null,
  "azucar_100g": number o null,
  "grasa_saturada_100g": number o null,
  "sodio_100g": number o null
}

Si un valor no es visible o legible, usa null. No inventes datos.
Si la etiqueta muestra valores por porcion, convierte a por 100g.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { image } = await request.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Imagen requerida (base64)" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
    if (image.startsWith("data:image/png")) mediaType = "image/png";
    else if (image.startsWith("data:image/webp")) mediaType = "image/webp";

    const base64Data = image.includes(",") ? image.split(",")[1] : image;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Extrae los valores nutricionales de esta etiqueta.",
            },
          ],
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "Respuesta vacia" }, { status: 500 });
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo parsear" }, { status: 500 });
    }

    const nutrition = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ nutrition });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
