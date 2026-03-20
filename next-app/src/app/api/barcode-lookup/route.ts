import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { barcode } = await request.json();

    if (!barcode || typeof barcode !== "string") {
      return NextResponse.json({ error: "Barcode requerido" }, { status: 400 });
    }

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const data = await res.json();

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ error: "Producto no encontrado en Open Food Facts" }, { status: 404 });
    }

    const p = data.product;
    const n = p.nutriments || {};

    return NextResponse.json({
      product: {
        name: p.product_name || "Sin nombre",
        brand: p.brands || "",
        image_url: p.image_url || null,
        kcal_100g: Math.round(n["energy-kcal_100g"] || 0),
        proteinas_100g: Math.round((n.proteins_100g || 0) * 10) / 10,
        carbs_100g: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
        grasas_100g: Math.round((n.fat_100g || 0) * 10) / 10,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
