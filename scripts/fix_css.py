import codecs

with open('popup/styles.css', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# The corruption starts with UTF-16 null bytes.
# Find the end of the clean CSS
# Let's split by "/* Playlist Title Hyperlink */" which I attempted to echo, or by null characters.
clean_text = text.split("\n\n \x00/\x00 *\x00")[0]
clean_text = clean_text.split("/* Playlist Title Hyperlink */")[0]

new_css = """
/* Playlist Title Hyperlink */
.playlist-title-link {
  color: var(--primary);
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  display: inline-block;
  word-break: break-word;
  vertical-align: middle;
}

.playlist-title-link:hover {
  color: #fff;
  text-shadow: 0 0 8px var(--primary-glow);
  text-decoration: underline;
}

/* Ensure label and value are aligned */
.summary-item .label {
  vertical-align: top;
  margin-right: 6px;
  line-height: 1.5;
}

.summary-item .value {
  display: inline-block;
  line-height: 1.5;
  vertical-align: top;
  max-width: calc(100% - 60px);
}
"""

with open('popup/styles.css', 'w', encoding='utf-8') as f:
    f.write(clean_text.strip() + "\n" + new_css)

print("Fixed CSS")
