// rules.js

/**
 * A simple Markdown to HTML parser.
 * Supports: #, ###, -, 1., and **bold**.
 */
function parseMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;

  // Helper function to handle bolding
  const formatBold = (text) =>
    text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  for (const line of lines) {
    let trimmedLine = line.trim();
    const isUl = trimmedLine.startsWith("- ");
    const isOl = trimmedLine.match(/^\d+\.\s/);

    // Close list tags if the current line is not a list item
    if (inUl && !isUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl && !isOl) {
      html += "</ol>";
      inOl = false;
    }

    if (trimmedLine.startsWith("# ")) {
      html += `<h1>${formatBold(trimmedLine.substring(2))}</h1>`;
    } else if (trimmedLine.startsWith("### ")) {
      html += `<h3>${formatBold(trimmedLine.substring(4))}</h3>`;
    } else if (isUl) {
      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }
      html += `<li>${formatBold(trimmedLine.substring(2))}</li>`;
    } else if (isOl) {
      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }
      html += `<li>${formatBold(trimmedLine.replace(/^\d+\.\s/, ""))}</li>`;
    } else if (trimmedLine) {
      html += `<p>${formatBold(trimmedLine)}</p>`;
    }
  }
  // Close any remaining list tags
  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";

  return html;
}

/**
 * Fetches rules from a file, parses them, and displays them in a modal.
 */
async function showRules(modalId, contentId, filePath) {
  const modalEl = document.getElementById(modalId);
  const contentEl = document.getElementById(contentId);
  if (!modalEl || !contentEl) return;

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`File not found: ${filePath}`);
    const markdown = await response.text();
    contentEl.innerHTML = parseMarkdown(markdown);
    modalEl.classList.remove("hidden");
  } catch (error) {
    contentEl.innerHTML = `<p>Error loading rules: ${error.message}</p>`;
    modalEl.classList.remove("hidden");
  }
}
