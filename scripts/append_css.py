css = """
.glitch-title {
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 2px;
  text-shadow: 0 0 10px var(--primary-glow);
  text-transform: uppercase;
  margin: 0;
  padding: 0;
}
.subtitle {
  color: var(--primary);
  font-size: 11px;
  letter-spacing: 1.5px;
  opacity: 0.9;
  margin-top: 4px;
}
"""
with open('popup/styles.css', 'a', encoding='utf-8') as f:
    f.write("\n" + css)
