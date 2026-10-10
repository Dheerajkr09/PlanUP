# 🎨 DOC 2: UI, CSS, & Design System (PlanUp)

## 🌌 1. Cyberpunk Aesthetic & Theme
The UI uses a dark, futuristic Cyberpunk theme.
- **Background**: `#0a0a0f` (deep dark) with a CSS grid pattern (`linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px)`).
- **Primary Color (Cyan/Neon Blue)**: `var(--primary) = #00f0ff`. Used for primary buttons, progress bars, hyperlinks, and input borders.
- **Secondary Color (Purple/Magenta)**: `var(--secondary) = #ff003c`. Used for accents, gradients, and secondary actions.
- **Glow Effects**: Heavy use of `box-shadow` and `text-shadow` (e.g., `0 0 10px rgba(0, 240, 255, 0.5)`) to create a "neon" effect.

## 📐 2. Alignment & Header Constraints (CRITICAL)
- **Header Structure**: The header must strictly be **left-aligned**.
  - `.header-content`: `display: flex; align-items: center; justify-content: flex-start; gap: 12px;`
  - `.header-text`: `text-align: left;`
- **Typography**: 
  - Title (`h1.glitch-title`): 24px, uppercase, `-webkit-linear-gradient` (cyan to purple), letter-spacing: 2px.
  - Subtitle (`.subtitle`): 12px, uppercase, letter-spacing: 2px.

## ✂️ 3. Truncation & Text Overflows
To maintain a clean 420px fixed-width popup without horizontal scrolling or breaking layouts:
- **Video Titles inside Day Cards**:
  - Class: `.video-title`
  - Rule: 2-line clamp maximum.
  - CSS: `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;`
- **Plan Item Titles (Dashboard list)**:
  - Class: `.plan-item-title`
  - Rule: 1-line truncation.
  - CSS: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;`
- **Playlist Summary Values**: Right-aligned, max-width 70%, single line truncation.

## 🔗 4. Hyperlinks & Interactions
- Video titles are rendered as `<a>` tags targeting `_blank`. 
- By default, they have `text-decoration: none` and `color: var(--accent-cyan)`.
- On `:hover`, they receive `text-decoration: underline; color: #fff; text-shadow: 0 0 8px var(--accent-cyan);`.
- *Note:* Do not apply `.playlist-title-link` to video items as it forces `display: block` and breaks inline flex layouts. Use `.video-title` class.

## 🏗️ 5. Dynamic DOM Generation
In `popup.js`, the UI is built via DOM manipulation:
- `renderPlansList()`: Builds the dashboard list of saved plans.
- `renderPlan()`: Builds the active plan view.
- `createDayCard()`: Builds the HTML for a single day.
- `createVideoItem()`: Builds the checkbox + hyperlinked video title. Includes logic to append `&t=XXXs` to YouTube URLs if a video starts mid-way.

## 🎯 6. Visual Bugs Prevented
- **Lingering Progress Bar**: When transitioning from viewing an active plan to creating a NEW plan (`isAddingNewPlan = true`), the `progressSection` must be explicitly hidden. Otherwise, it inherits the `X%` value of the previously viewed plan and displays it under the Playlist Summary.
