import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";

// We import the source directly; esbuild/vitest will handle ESM.
// To keep the test self-contained, replicate the detection function's
// public surface by importing from the source file.

const SAMPLE_HTML = `
<div class="RDz9ad r1jLeb">
  <div tabindex="0" aria-label="Text, Apache Security &amp; Configuration Checklist.md."
       class="xmzFqe iPhdvc" role="button"
       title="Apache Security &amp; Configuration Checklist.md" data-action="8">
    <div class="nmzsyc r1jLeb">
      <img class="INRavc hL6y0b"
           src="https://chat.google.com/u/2/api/get_attachment_url?url_type=THUMBNAIL_URL&content_type=text%2Fmarkdown&attachment_token=ABC&allow_caching=true&sz=w512&authuser=2"
           alt="Apache Security &amp; Configuration Checklist.md">
      <span class="pohuVb"
            style="background-image: url(&quot;https://drive-thirdparty.googleusercontent.com/128/type/text/markdown&quot;);"></span>
      <div class="NulMW"></div>
    </div>
    <div class="zFEXud">
      <span class="opXI8"
            style="background-image: url(&quot;https://drive-thirdparty.googleusercontent.com/32/type/text/markdown&quot;);"></span>
      <span class="RhNmFb">Apache Security &amp; Configuration Checklist.md</span>
      <a class="vIQv5e" data-action="8" rel="noopener nofollow noreferrer" target="_blank"
         href="https://chat.google.com/u/2/api/get_attachment_url?url_type=DOWNLOAD_URL&attachment_token=ABC&content_type=text%2Fmarkdown&auto=true&authuser=2"
         referrerpolicy="origin">
        <button aria-label="Open in new tab"></button>
      </a>
    </div>
  </div>
</div>`;

describe("findMarkdownChips", async () => {
  const dom = new JSDOM(SAMPLE_HTML, { url: "https://chat.google.com/u/2" });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  const { findMarkdownChips } = await import("../src/content/detect.js");

  it("detects a .md chip with download URL", () => {
    const chips = findMarkdownChips(document.body, ["md", "markdown"]);
    expect(chips).toHaveLength(1);
    expect(chips[0].filename).toBe("Apache Security & Configuration Checklist.md");
    expect(chips[0].url).toContain("url_type=DOWNLOAD_URL");
    expect(chips[0].url).toContain("attachment_token=ABC");
  });

  it("returns empty when extension list excludes .md", () => {
    const chips = findMarkdownChips(document.body, ["txt"]);
    expect(chips).toHaveLength(0);
  });
});