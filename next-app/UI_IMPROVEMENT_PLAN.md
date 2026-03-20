# UI Improvement Plan — Pocket Diet

Plan incremental de mejora visual. Cada fase es independiente y se puede implementar en una sesion.

---

## Principios de diseño

- **Mobile-first**: Todo se diseña primero para movil (touch targets >= 44px)
- **Dark theme nativo**: No es un tema claro invertido; usar sombras y elevacion con opacidad
- **Feedback inmediato**: Toda accion del usuario debe tener respuesta visual (transiciones, loaders, toasts)
- **Consistencia**: Componentes reutilizables en vez de estilos inline repetidos
- **Minimalismo funcional**: Cada elemento visual debe tener un proposito

## Paleta de colores actual + propuesta

```
Actual:
  background: #0E1117
  surface:    #1A1D23
  border:     #2D3139
  brand:      #FF6B35

Propuesta (añadir):
  success:    #10B981  (green-500)
  danger:     #EF4444  (red-500)
  warning:    #F59E0B  (amber-500)
  info:       #3B82F6  (blue-500)
  surface-elevated: #22252B  (cards con elevacion)
```

---

## Fase 1: Fundacion (tailwind.config + componentes base)

**Objetivo**: Establecer la base visual antes de tocar paginas individuales.

### 1.1 Tipografia
- Importar font **Inter** o **Geist** via `next/font/google` en `layout.tsx`
- Aplicar `antialiased` al body
- Definir escala tipografica semantica en Tailwind:
  ```
  heading-xl: text-3xl font-bold tracking-tight
  heading-lg: text-2xl font-bold
  heading-md: text-lg font-semibold
  body:       text-sm text-gray-300
  caption:    text-xs text-gray-500
  ```

### 1.2 Colores semanticos en tailwind.config
- Añadir `success`, `danger`, `warning`, `info` al theme
- Añadir `surface-elevated` para cards con profundidad
- Definir variantes de opacidad: `brand-hover`, `brand-muted`

### 1.3 Sombras y elevacion
- Añadir en tailwind.config:
  ```
  boxShadow: {
    card: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    elevated: '0 4px 12px rgba(0,0,0,0.4)',
    glow: '0 0 20px rgba(255, 107, 53, 0.15)',
  }
  ```

### 1.4 Componente Button reutilizable
- **Archivo**: `src/components/ui/button.tsx`
- Variantes: `primary` (brand), `secondary` (surface), `ghost` (transparente), `danger`
- Tamaños: `sm`, `md`, `lg`
- Estados: hover, disabled, loading (spinner)
- Usar `class-variance-authority` (ya instalado)

### 1.5 Componente Input reutilizable
- **Archivo**: `src/components/ui/input.tsx`
- Focus state prominente: `focus:ring-2 focus:ring-brand` (sin opacity)
- Label integrado, mensaje de error opcional
- Variantes: default, error, success

### Archivos a modificar:
- `tailwind.config.js` — colores, sombras, tipografia
- `src/app/layout.tsx` — importar font
- `src/components/ui/button.tsx` — nuevo
- `src/components/ui/input.tsx` — nuevo

---

## Fase 2: Navegacion (app-shell.tsx)

**Objetivo**: Bottom nav mas usable y visualmente clara.

### Mejoras:
1. **Aumentar altura bottom nav**: `h-16` → `h-20` para touch targets comodos
2. **Texto mas legible**: `text-[10px]` → `text-xs`, padding `py-1` → `py-2`
3. **Active state visible**: Añadir `bg-brand/10 rounded-lg` al item activo en movil
4. **Transiciones suaves**: `transition-colors duration-200` en todos los items
5. **Indicador de "Mas"**: Chevron o badge para señalar dropdown
6. **Sidebar desktop**: Añadir sombra derecha sutil y separador visual del contenido

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

---

## Orden de implementacion recomendado

```
Sesion 1: Fase 1 (fundacion) — impacto: ALTO, esfuerzo: MEDIO
Sesion 2: Fase 2 (navegacion) — impacto: ALTO, esfuerzo: BAJO
Sesion 3: Fase 4.1 (macro display) — impacto: ALTO, esfuerzo: BAJO
Sesion 4: Fase 3 (dashboard) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 5: Fase 5 (formularios + toast) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 6: Fase 4.2 (food log) — impacto: MEDIO, esfuerzo: MEDIO
Sesion 7: Fase 6 (animaciones) — impacto: BAJO, esfuerzo: VARIABLE
```

## Referencia de diseño

Repos consultados para inspiracion:
- https://github.com/mustafakendiguzel/claude-code-ui-agents
- https://github.com/Dammyjay93/interface-design
