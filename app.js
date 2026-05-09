const DEFAULT_TITLE = "AIニュース共有";
const DEFAULT_DESCRIPTION =
  "Markdown風テキストから、URLだけで共有できるニュース一覧を作れます。";
const DEFAULT_SECTION_TITLE = "ニュース";
const SAMPLE_MARKDOWN = `# トップニュース
### Helix-02, 掃除とベットメイキングを2分以内に実行させることを教えました。
https://x.com/Figure_robot/status/2052770982214172892
https://www.figure.ai/news/helix-02-bedroom-tidy

# その他
### CodexのGoals機能により、ARC-AGI-3で61%のスコア
https://x.com/patience_cave/status/2052772581888156128?s=20`;

const elements = {
  titleInput: document.querySelector("#titleInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  markdownInput: document.querySelector("#markdownInput"),
  pageTitle: document.querySelector("#pageTitle"),
  pageDescription: document.querySelector("#pageDescription"),
  itemCount: document.querySelector("#itemCount"),
  newsContainer: document.querySelector("#newsContainer"),
  sourceNotice: document.querySelector("#sourceNotice"),
  shareForm: document.querySelector("#shareForm"),
  shareUrl: document.querySelector("#shareUrl"),
  copyButton: document.querySelector("#copyButton"),
  statusText: document.querySelector("#statusText"),
  renderButton: document.querySelector("#renderButton"),
  sampleButton: document.querySelector("#sampleButton"),
};

let renderTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  void initialize();
});

async function initialize() {
  const loaded = await loadStateFromUrl();
  if (!loaded) {
    setReaderMode(false);
    renderCurrentInputs("フォーム入力、またはURL内の共有データから表示します。");
  }

  window.addEventListener("hashchange", () => {
    void loadStateFromUrl();
  });

  elements.shareForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void createShareUrl();
  });

  elements.renderButton.addEventListener("click", () => {
    renderCurrentInputs("フォーム入力を表示中です。");
  });

  elements.copyButton.addEventListener("click", () => {
    void copyShareUrl();
  });

  elements.sampleButton.addEventListener("click", () => {
    elements.titleInput.value = DEFAULT_TITLE;
    elements.descriptionInput.value = "今日気になったニュース";
    elements.markdownInput.value = SAMPLE_MARKDOWN;
    renderCurrentInputs("サンプルを表示中です。");
  });

  [elements.titleInput, elements.descriptionInput, elements.markdownInput].forEach(
    (input) => {
      input.addEventListener("input", () => {
        window.clearTimeout(renderTimer);
        renderTimer = window.setTimeout(() => {
          renderCurrentInputs("フォーム入力を表示中です。");
        }, 220);
      });
    },
  );
}

async function loadStateFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const data = hashParams.get("data");

  if (data) {
    try {
      const payload = await decodePayload(data);
      const state = normalizePayload(payload);
      applyStateToForm(state);
      setReaderMode(true);
      renderState(state, "#data= から復元したニュースを表示中です。");
      return true;
    } catch (error) {
      setReaderMode(false);
      showStatus(`URL内の共有データを復元できませんでした: ${error.message}`, true);
      renderCurrentInputs("共有データの復元に失敗しました。");
      return true;
    }
  }

  const legacyState = parseLegacyQuery(window.location.search);
  if (legacyState) {
    applyStateToForm(legacyState);
    setReaderMode(true);
    renderState(legacyState, "互換URL形式から復元したニュースを表示中です。");
    return true;
  }

  setReaderMode(false);
  return false;
}

function setReaderMode(enabled) {
  document.body.classList.toggle("reader-mode", enabled);
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("データ形式が正しくありません");
  }

  return {
    title: typeof payload.title === "string" ? payload.title : DEFAULT_TITLE,
    description:
      typeof payload.description === "string" ? payload.description : "",
    markdown: typeof payload.markdown === "string" ? payload.markdown : "",
  };
}

function parseLegacyQuery(search) {
  if (!search || search === "?") {
    return null;
  }

  const params = new URLSearchParams(search);
  const title = params.get("title") || DEFAULT_TITLE;
  const description = params.get("desc") || params.get("description") || "";
  const paramUrls = params.getAll("u").map(normalizeUrl).filter(Boolean);

  if (paramUrls.length > 0) {
    return {
      title,
      description,
      markdown: buildMarkdownFromUrls(paramUrls),
    };
  }

  const rawParts = search
    .replace(/^\?/, "")
    .split("&")
    .map((part) => safeDecode(part.replace(/\+/g, "%20")).trim())
    .filter(Boolean);
  const shortUrls = rawParts.map(normalizeUrl).filter(Boolean);

  if (shortUrls.length === 0) {
    return null;
  }

  return {
    title,
    description,
    markdown: buildMarkdownFromUrls(shortUrls),
  };
}

function buildMarkdownFromUrls(urls) {
  return [`# 共有リンク`, ...urls].join("\n");
}

function applyStateToForm(state) {
  elements.titleInput.value = state.title || DEFAULT_TITLE;
  elements.descriptionInput.value = state.description || "";
  elements.markdownInput.value = state.markdown || "";
}

function getCurrentState() {
  return {
    title: elements.titleInput.value.trim() || DEFAULT_TITLE,
    description: elements.descriptionInput.value.trim(),
    markdown: elements.markdownInput.value.trim(),
  };
}

function renderCurrentInputs(notice) {
  renderState(getCurrentState(), notice);
}

function renderState(state, notice) {
  const data = parseMarkdownNews(state.markdown);
  const title = state.title || DEFAULT_TITLE;
  const description = state.description || DEFAULT_DESCRIPTION;

  updateDocumentMetadata(title, description);
  elements.pageTitle.textContent = title;
  elements.pageDescription.textContent = description;
  elements.itemCount.textContent = String(countItems(data.sections));
  elements.sourceNotice.textContent = notice;

  replaceChildren(elements.newsContainer, renderNewsSections(data.sections));
  hydrateTweets();
}

function updateDocumentMetadata(title, description) {
  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}

function setMetaContent(selector, content) {
  const meta = document.querySelector(selector);
  if (meta) {
    meta.setAttribute("content", content);
  }
}

function parseMarkdownNews(markdown) {
  const sections = [];
  let currentSection = null;
  let currentItem = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { title: DEFAULT_SECTION_TITLE, items: [] };
      sections.push(currentSection);
    }
    return currentSection;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^#(?!#)\s+(.+)$/);
    if (sectionMatch) {
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      sections.push(currentSection);
      currentItem = null;
      continue;
    }

    const itemMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (itemMatch) {
      const section = ensureSection();
      currentItem = { title: itemMatch[1].trim(), urls: [], implicit: false };
      section.items.push(currentItem);
      continue;
    }

    const urls = extractUrls(line);
    if (urls.length > 0) {
      const section = ensureSection();
      if (currentItem && !currentItem.implicit) {
        currentItem.urls.push(...urls);
      } else {
        for (const url of urls) {
          section.items.push({ title: "", urls: [url], implicit: true });
        }
        currentItem = null;
      }
    }
  }

  return {
    sections: sections
      .map((section) => ({
        ...section,
        items: section.items
          .map((item) => ({
            title: item.title,
            urls: Array.from(new Set(item.urls.map(normalizeUrl).filter(Boolean))),
          }))
          .filter((item) => item.title || item.urls.length > 0),
      }))
      .filter((section) => section.items.length > 0),
  };
}

function renderNewsSections(sections) {
  if (sections.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "まだニュース本文がありません。左のフォームに見出しとURLを貼り付けてください。";
    return [empty];
  }

  return sections.map((section) => {
    const wrapper = document.createElement("section");
    wrapper.className = "news-section";

    const heading = document.createElement("h3");
    heading.className = "section-title";
    heading.textContent = section.title || DEFAULT_SECTION_TITLE;
    wrapper.append(heading);

    for (const item of section.items) {
      wrapper.append(renderNewsItem(item));
    }

    return wrapper;
  });
}

function renderNewsItem(item) {
  const article = document.createElement("article");
  article.className = "news-item";

  const title = document.createElement("h4");
  title.className = item.title ? "item-title" : "item-title empty-title";
  title.textContent = item.title || "単独リンク";
  article.append(title);

  const list = document.createElement("div");
  list.className = "url-list";
  for (const url of item.urls) {
    list.append(isXStatusUrl(url) ? renderTweet(url) : renderLinkCard(url));
  }
  article.append(list);

  return article;
}

function renderTweet(url) {
  const canonicalUrl = toCanonicalXStatusUrl(url);
  const shell = document.createElement("div");
  shell.className = "tweet-shell";

  const blockquote = document.createElement("blockquote");
  blockquote.className = "twitter-tweet";
  blockquote.dataset.dnt = "true";

  const tweetLink = document.createElement("a");
  tweetLink.href = canonicalUrl;
  tweetLink.target = "_blank";
  tweetLink.rel = "noopener noreferrer";
  tweetLink.textContent = canonicalUrl;
  blockquote.append(tweetLink);

  const fallback = document.createElement("a");
  fallback.className = "tweet-fallback";
  fallback.href = canonicalUrl;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  fallback.textContent = "Xで投稿を開く";

  shell.append(blockquote, fallback);
  return shell;
}

function renderLinkCard(url) {
  const parsed = new URL(url);
  const card = document.createElement("a");
  card.className = "link-card";
  card.href = url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const domain = document.createElement("span");
  domain.className = "link-domain";
  domain.textContent = parsed.hostname.replace(/^www\./, "");

  const title = document.createElement("span");
  title.className = "link-title";
  title.textContent = makeReadableLinkTitle(parsed);

  const displayUrl = document.createElement("span");
  displayUrl.className = "link-url";
  displayUrl.textContent = url;

  card.append(domain, title, displayUrl);
  return card;
}

function makeReadableLinkTitle(url) {
  const path = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .join(" / ");
  return path || url.hostname;
}

function hydrateTweets() {
  if (!document.querySelector(".twitter-tweet")) {
    return;
  }

  if (window.twttr?.widgets?.load) {
    window.twttr.widgets.load(elements.newsContainer);
    return;
  }

  if (document.querySelector('script[data-twitter-widgets="true"]')) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://platform.twitter.com/widgets.js";
  script.async = true;
  script.charset = "utf-8";
  script.dataset.twitterWidgets = "true";
  document.body.append(script);
}

async function createShareUrl() {
  const state = getCurrentState();
  const token = await encodePayload(state);
  const baseUrl = window.location.href.split("#")[0].split("?")[0];
  const shareUrl = `${baseUrl}#data=${token}`;

  elements.shareUrl.value = shareUrl;
  elements.copyButton.disabled = false;
  renderState(state, "共有URLを生成した内容を表示中です。");
  showStatus(`共有URLを作成しました。長さ: ${shareUrl.length.toLocaleString()}文字`);
}

async function copyShareUrl() {
  if (!elements.shareUrl.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(elements.shareUrl.value);
    showStatus("共有URLをコピーしました。");
  } catch {
    elements.shareUrl.select();
    showStatus("コピーできない環境です。URL欄を選択しました。");
  }
}

async function encodePayload(payload) {
  const json = JSON.stringify({ v: 1, ...payload });
  const bytes = new TextEncoder().encode(json);

  if ("CompressionStream" in window) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return `gz.${bytesToBase64Url(compressed)}`;
  }

  return `raw.${bytesToBase64Url(bytes)}`;
}

async function decodePayload(token) {
  const [kind, value] = splitToken(token);
  const bytes = base64UrlToBytes(value);

  if (kind === "raw") {
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  if (kind === "gz") {
    if (!("DecompressionStream" in window)) {
      throw new Error("このブラウザは圧縮データの復元に対応していません");
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const decompressed = await new Response(stream).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(decompressed));
  }

  throw new Error("未対応の共有データ形式です");
}

function splitToken(token) {
  if (token.startsWith("gz.")) {
    return ["gz", token.slice(3)];
  }

  if (token.startsWith("raw.")) {
    return ["raw", token.slice(4)];
  }

  return ["gz", token];
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function extractUrls(line) {
  const matches = line.match(/https?:\/\/[^\s<>"']+/g) || [];
  return matches.map(stripTrailingUrlPunctuation).map(normalizeUrl).filter(Boolean);
}

function stripTrailingUrlPunctuation(value) {
  return value.replace(/[。、，,.)\]]+$/g, "");
}

function normalizeUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (["twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(url.hostname)) {
      url.hostname = "x.com";
    }

    if (url.hostname === "www.x.com") {
      url.hostname = "x.com";
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isXStatusUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return false;
  }

  const url = new URL(normalized);
  return url.hostname === "x.com" && /^\/[^/]+\/status\/\d+/.test(url.pathname);
}

function toCanonicalXStatusUrl(value) {
  const normalized = normalizeUrl(value);
  const url = new URL(normalized);
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);

  if (!match) {
    return normalized;
  }

  return `https://x.com/${match[1]}/status/${match[2]}`;
}

function countItems(sections) {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

function replaceChildren(parent, children) {
  parent.replaceChildren(...children);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function showStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("error", isError);
}
