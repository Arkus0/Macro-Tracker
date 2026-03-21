# UI Improvement Plan — Pocket Diet

Plan incremental de mejora visual. Cada fase es independiente y se puede implementar en una sesion.

---

## Principios de diseño

- **Mobile-first**: Todo se diseña primero para movil (touch targets min 44px / `min-h-[44px]`)
- **Dark theme nativo**: Elevacion via lightness, no sombras. Bordes con `border-white/[.06]`
- **Feedback inmediato**: Respuesta visual < 100ms (`duration-100`), animaciones < 300ms
- **Consistencia**: Componentes reutilizables, no estilos inline repetidos
- **Minimalismo funcional**: Cada elemento visual tiene un proposito
- **Accesibilidad**: Contraste minimo 4.5:1 (WCAG AA), respetar `prefers-reduced-motion`
- **Numeros legibles**: `tabular-nums` en TODAS las cifras (kcal, gramos, peso, macros)

## Tokens de diseño

### Paleta de colores actual + propuesta

```
Actual:
  background: #0E1117
  surface:    #1A1D23
  border:     #2D3139
  brand:      #FF6B35

Propuesta (añadir colores semanticos):
  success:    #10B981  (green-500)
  danger:     #EF4444  (red-500)
  warning:    #F59E0B  (amber-500)
  info:       #3B82F6  (blue-500)

Propuesta (sistema de elevacion por lightness — NO sombras en dark mode):
  Level 0 (base):      #0E1117  (background actual)
  Level 1 (card):      #161B22  (~7% mas claro)
  Level 2 (raised):    #1C2128  (~9% mas claro)
  Level 3 (modal):     #22272E  (~11% mas claro)
  Bordes:              rgba(255, 255, 255, 0.06) → `border-white/[.06]`
```

### Spacing (base 4px, escala Tailwind nativa)
```
Precision (data-dense): p-1(4) p-2(8) p-3(12) p-4(16) p-6(24) p-8(32)
Warmth (screens amigables): p-2(8) p-3(12) p-4(16) p-6(24) p-8(32) p-12(48)

Usar "Precision" en: food log tables, macro display, analytics
Usar "Warmth" en: coach, login, dashboard, onboarding
```

### Border radius
```
Data-dense (tablas, macro bars): rounded-md (6px)
Cards y containers:              rounded-lg (8px)
Botones y inputs:                rounded-lg (8px)
Modales:                         rounded-xl (12px)
```

### Componentes referencia (specs de interface-design)
```
Button:  h-10(40px) px-5 rounded-lg text-[15px] font-medium
Input:   h-11(44px) px-4 rounded-lg border-[1.5px] border-white/[.06]
Card:    border border-white/[.06] p-4 rounded-xl (no shadow en dark)
Table:   cells px-3 py-2 text-[13px] tabular-nums border-b border-white/[.06]
```

---

## Fase 1: Fundacion (tailwind.config + componentes base) ✅ COMPLETADA

**Objetivo**: Establecer la base visual antes de tocar paginas individuales.

**Estado**: IMPLEMENTADA. Todos los items completados:

### 1.1 Tipografia ✅
- ✅ Inter importado via `next/font/google` en `layout.tsx` con variable CSS `--font-inter`
- ✅ `antialiased` aplicado al body via `globals.css`
- ✅ `fontFamily.sans` configurado en tailwind.config con Inter como primera opcion

### 1.2 Colores semanticos en tailwind.config ✅
- ✅ `success` (#10B981), `danger` (#EF4444), `warning` (#F59E0B), `info` (#3B82F6) en theme
- ✅ `surface-1`, `surface-2`, `surface-3` para elevacion
- ✅ `surface-hover` para estados hover

### 1.3 Elevacion y bordes (dark mode strategy) ✅
- ✅ `surface-1` (#161B22), `surface-2` (#1C2128), `surface-3` (#22272E) en tailwind.config
- ✅ `shadow-glow` (0 0 20px rgba(255, 107, 53, 0.15)) para hover en brand elements
- ✅ Patron de card: `bg-surface-1 border border-white/[.06] rounded-xl` (sin shadow)

### 1.4 Componente Button reutilizable ✅
- ✅ `src/components/ui/button.tsx` con class-variance-authority
- ✅ 4 variantes: `primary` (brand), `secondary` (surface-2), `ghost`, `danger`
- ✅ 3 tamaños: `sm` (h-8), `md` (h-10), `lg` (h-12)
- ✅ Estados: hover (duration-100), disabled (opacity-50), loading (spinner SVG animado)
- ✅ forwardRef + tipos exportados (ButtonProps, buttonVariants)

### 1.5 Componente Input reutilizable ✅
- ✅ `src/components/ui/input.tsx` con forwardRef
- ✅ Focus state: `focus:ring-2 focus:ring-brand focus:border-transparent`
- ✅ Label integrado con `htmlFor` automatico
- ✅ Mensaje de error con `text-danger` + borde `border-danger`
- ✅ Spec: `h-11 px-4 rounded-lg border-[1.5px] border-white/[.06]`

### 1.6 Tipografia numerica ✅
- ✅ Clase utilitaria `.nums` (font-variant-numeric: tabular-nums) en globals.css

### Archivos modificados:
- ✅ `tailwind.config.js` — colores semanticos, superficies, sombra glow, fontFamily
- ✅ `src/app/layout.tsx` — Inter font importado con variable CSS
- ✅ `src/app/globals.css` — antialiased, .nums utility
- ✅ `src/components/ui/button.tsx` — nuevo
- ✅ `src/components/ui/input.tsx` — nuevo

---

## Fase 2: Navegacion (app-shell.tsx)

**Objetivo**: Bottom nav mas usable y visualmente clara.

### Mejoras:
1. **Aumentar altura bottom nav**: `h-16` → `h-20` para touch targets comodos (min 44px por item)
2. **Texto mas legible**: `text-[10px]` → `text-xs`, padding `py-1` → `py-2`
3. **Active state visible**: `bg-brand/10 rounded-lg` al item activo + icono en `text-brand`
4. **Transiciones rapidas**: `transition-colors duration-100` (feedback < 100ms)
5. **Gap entre items**: Min 8px gap entre elementos interactivos adyacentes
6. **Indicador de "Mas"**: Chevron para señalar dropdown
7. **Sidebar desktop**: Borde derecho `border-white/[.06]` en vez de sombra
8. **Safe area**: Considerar `pb-safe` para dispositivos con home indicator

### Archivos a modificar:
- `src/components/app-shell.tsx`

---

## Fase 3: Dashboard y Cards (page.tsx home)

**Objetivo**: Dashboard mas informativo y visualmente jerarquico.

### Mejoras:
1. **Skeleton loaders**: Mostrar `animate-pulse` placeholders mientras carga data
2. **Stat cards con elevacion**: Usar `shadow-card` en vez de solo `border`
3. **Card de target diferenciada**: Fondo `bg-brand/5` + borde `border-brand/20`
4. **Valores mas grandes**: Stats principales en `text-3xl font-bold`
5. **Contexto temporal**: Mostrar "hace 2 dias" junto al ultimo peso
6. **Quick links mejorados**: `hover:border-brand/30 hover:shadow-glow` + padding `py-4`
7. **Greeting personalizado**: "Buenos dias, [nombre]" segun hora del dia

### Archivos a modificar:
- `src/app/(authenticated)/page.tsx`

---

## Fase 4: Macro Display y Food Log

**Objetivo**: Barras de progreso mas visibles y food log mas pulido.

### 4.1 Macro Display (`macro-display.tsx`)
1. **Barras mas gruesas**: `h-1.5` → `h-2.5`
2. **Quitar opacity**: Las barras deben ser color solido
3. **Animacion de llenado**: `transition-all duration-700 ease-out`
4. **Warning al pasar 100%**: Cambiar color a `danger` + texto "+X%"
5. **Gradiente sutil**: Añadir gradiente al fill de la barra para profundidad

### 4.2 Food Log (`food-log/page.tsx`)
1. **Tabs mejorados**: Indicador activo mas visible, scroll horizontal suave
2. **Cards de comida**: Sombra sutil, swipe-to-delete en movil (futuro)
3. **Boton "Añadir" flotante**: FAB (floating action button) en la esquina inferior
4. **Resultados de busqueda**: Mejor separacion visual, highlight de macros

### Archivos a modificar:
- `src/components/macro-display.tsx`
- `src/app/(authenticated)/food-log/page.tsx`

---

## Fase 5: Formularios y Feedback

**Objetivo**: Inputs consistentes y feedback visual para todas las acciones.

### 5.1 Formularios
1. **Usar componentes Input/Button** de Fase 1 en todas las paginas
2. **Agrupar inputs visualmente**: Container con `bg-surface-elevated rounded-xl p-4`
3. **Labels mejorados**: `text-gray-300 font-medium` en vez de `text-gray-400`
4. **Mensajes de error/exito animados**: Fade-in desde arriba

### 5.2 Sistema de Toast/Notificaciones
- **Archivo**: `src/components/ui/toast.tsx`
- Notificaciones flotantes para: guardado exitoso, errores, copiar dia, etc.
- Auto-dismiss en 3 segundos
- Colores semanticos: success (verde), error (rojo), info (azul)

### 5.3 Paginas a actualizar (migrar a componentes UI):
- `peso/page.tsx` — formulario de peso
- `coach/page.tsx` — setup form
- `targets/page.tsx` — target configuration
- `recetas/page.tsx` — recipe builder
- `medidas/page.tsx` — body measurements form

### Archivos a crear:
- `src/components/ui/toast.tsx`
### Archivos a modificar:
- Todas las paginas con formularios

---

## Fase 6 (Opcional): Animaciones y Microinteracciones

**Objetivo**: Pulido final con animaciones sutiles.

### Ideas:
1. **Page transitions**: Fade-in al navegar entre paginas
2. **Number animations**: Counters animados en stats del dashboard
3. **Pull-to-refresh**: En food log y peso (si se implementa como PWA)
4. **Haptic feedback**: Vibracion al completar acciones en movil
5. **Confetti/celebration**: Al alcanzar un goal o completar un check-in
6. **Chart animations**: Lineas que se dibujan progresivamente en Recharts

### Reglas de animacion:
- Todas las animaciones < 300ms
- Solo animar `transform` y `opacity` (GPU-accelerated, no layout-triggering)
- Easing natural (ease-out para entradas, ease-in para salidas)
- SIEMPRE respetar `prefers-reduced-motion`: `motion-reduce:transition-none`

---

## Orden de implementacion recomendado

```
Sesion 1: Fase 1 (fundacion) — ✅ COMPLETADA
Sesion 2: Fase 2 (navegacion) — impacto: ALTO, esfuerzo: BAJO
Sesion 3: Fase 4.1 (macro display) — impacto: ALTO, esfuerzo: BAJO
Sesion 4: Fase 3 (dashboard) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 5: Fase 5 (formularios + toast) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 6: Fase 4.2 (food log) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 7: Fase 6 (animaciones) — impacto: BAJO, esfuerzo: VARIABLE
```

## Referencia de diseño

Repos consultados para inspiracion:
- https://github.com/mustafakendiguzel/claude-code-ui-agents — Mobile design philosophy, touch targets, animation timing
- https://github.com/Dammyjay93/interface-design — Design tokens, elevation system, component specs (Precision vs Warmth)

### Patron recomendado para Pocket Diet:
- **Precision** (data-dense) en: food log, macro display, analytics, tablas
- **Warmth** (amigable) en: coach, login, dashboard, onboarding
- Hibrido que prioriza legibilidad de datos sin sacrificar calidez en pantallas de interaccion
