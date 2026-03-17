import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import docxFileIcon from "../../images/docx-file.png";
import pdfFileIcon from "../../images/pdf-file-format.png";

const HOST = "https://daily-headcount-ai-backend.onrender.com";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const state = location.state;
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [data, setData] = useState(state?.tableData || null);
  const [blueprint, setBlueprint] = useState(state?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(state?.currentSheet || "");
  const [allSheets] = useState(state?.allSheets || []);
  const [fileName] = useState(state?.fileName || "");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);

  // Drive info for sheet switching + real-time (future)
  const driveFileId = state?.driveFileId || null;
  const accessToken = state?.accessToken || null;

  useEffect(() => {
    if (!state?.tableData) navigate("/");
  }, [state, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (authLoading) return null;
  if (!data || !blueprint || !user) return null;

  const fetchSheetData = async (sheet) => {
    setSwitching(true);
    setSwitchError("");

    try {
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!dlRes.ok) throw new Error("Failed to download file from Drive");

      const arrayBuffer = await dlRes.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();
      formData.append("file", blob, fileName);

      const res = await fetch(
        `${HOST}/analyze-bytes?sheet_name=${encodeURIComponent(sheet)}`,
        { method: "POST", body: formData }
      );
      const result = await res.json();

      if (result.error) {
        setSwitchError(result.error);
        setSwitching(false);
        return;
      }

      setData(result.tableData);
      setBlueprint(result.blueprint);
      setCurrentSheet(result.currentSheet);
    } catch (err) {
      setSwitchError(`Failed to load sheet: ${err.message}`);
    }

    setSwitching(false);
  };

  const switchSheet = async (sheet) => {
    if (switching) return;
    await fetchSheetData(sheet);
  };

  const refreshDashboard = async () => {
    const targetSheet = currentSheet || allSheets[0] || "";
    if (!targetSheet || switching) {
      if (!targetSheet) setSwitchError("No sheet selected to refresh");
      return;
    }
    await fetchSheetData(targetSheet);
  };

  const activeSheetName = currentSheet || allSheets[0] || "Sheet1";

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const collectAssistantMessages = (panelRoot) => {
    if (!panelRoot) return [];
    const messageContainer = panelRoot.querySelector(".flex-1");
    if (!messageContainer) return [];
    const rows = Array.from(messageContainer.children).filter((node) => node?.className?.includes("flex"));
    const entries = [];
    const greetingPrefix = "Hi! I have access to your full dataset";
    rows.forEach((row) => {
      const isUser = row.className.includes("items-end");
      const bubble = row.querySelector("div[style*=\"border-bottom-right-radius\"]")
        || row.querySelector("div[style*=\"border-bottom-left-radius\"]")
        || row.querySelector("div[class*=\"rounded\"]");
      if (!bubble) return;
      const text = (bubble.textContent || "").trim();
      if (!text) return;
      if (!isUser && text.startsWith(greetingPrefix)) return;
      if (isUser) {
        entries.push(`<div class="report-ai-message report-ai-user"><strong>User:</strong> ${escapeHtml(text)}</div>`);
      } else {
        entries.push(`<div class="report-ai-message"><strong>Assistant:</strong> ${bubble.innerHTML}</div>`);
      }
    });
    return entries;
  };

  const cleanCloneForReport = (root) => {
    root.querySelectorAll("button, input, select, textarea, details, summary").forEach((el) => el.remove());
    root.querySelectorAll(".chart-widget__actions, .chart-widget__pin").forEach((el) => el.remove());
    Array.from(root.querySelectorAll("*")).forEach((el) => {
      if (el.style.display === "flex" || el.style.display === "inline-flex") {
        el.style.display = "block";
        el.style.gap = "";
        el.style.alignItems = "";
        el.style.justifyContent = "";
        el.style.flexDirection = "";
      }
      if (el.style.display === "grid") {
        el.style.display = "block";
      }
      if (el.style.whiteSpace === "nowrap") {
        el.style.whiteSpace = "normal";
      }
    });
    const removeByText = (matcher) => {
      Array.from(root.querySelectorAll("*")).forEach((el) => {
        if (el.children.length > 0) return;
        const text = (el.textContent || "").trim();
        if (!text) return;
        if (matcher(text)) el.remove();
      });
    };
    removeByText((text) => /[▲▼]/.test(text));
    removeByText((text) => /🔍/.test(text));
    removeByText((text) => /page size/i.test(text));
    removeByText((text) => /page\s+\d+\s+of\s+\d+/i.test(text));
    removeByText((text) => /rows\s*·\s*\d+/i.test(text) || /rows\s+·\s+/i.test(text));
    removeByText((text) => /columns/i.test(text) && /rows/i.test(text));
    removeByText((text) => /^[«‹›»…]+$/.test(text));
    removeByText((text) => /filtered/i.test(text) && /rows/i.test(text));
    return root;
  };

  const resolveSvgVars = (svgString) => (
    svgString.replace(/var\(\s*(--[^,\s)]+)\s*(?:,\s*([^)]+))?\)/g, (match, varName, fallback) => {
      const mapped = CSS_VAR_MAP[varName];
      if (mapped) return mapped;
      if (fallback) return fallback.trim();
      return match;
    })
  );

  const inlineSvgStyles = (sourceSvg, targetSvg) => {
    const selectors = ["path", "rect", "circle", "ellipse", "line", "polygon", "polyline", "text"];
    selectors.forEach((selector) => {
      const sourceNodes = Array.from(sourceSvg.querySelectorAll(selector));
      const targetNodes = Array.from(targetSvg.querySelectorAll(selector));
      const count = Math.min(sourceNodes.length, targetNodes.length);
      for (let i = 0; i < count; i += 1) {
        const source = sourceNodes[i];
        const target = targetNodes[i];
        const style = window.getComputedStyle(source);
        const applyAttr = (attr, cssProp) => {
          const current = target.getAttribute(attr);
          const value = style.getPropertyValue(cssProp);
          if (value && (!current || current.includes("var("))) {
            target.setAttribute(attr, value.trim());
          }
        };
        applyAttr("fill", "fill");
        applyAttr("stroke", "stroke");
        applyAttr("stroke-width", "stroke-width");
        applyAttr("opacity", "opacity");
        applyAttr("fill-opacity", "fill-opacity");
        applyAttr("stroke-opacity", "stroke-opacity");
        if (selector === "text") {
          applyAttr("font-size", "font-size");
          applyAttr("font-family", "font-family");
        }
      }
    });
  };

  const serializeSvg = (svgEl, targetWidth = 900, idPrefix = "", options = {}) => {
    try {
      const clone = svgEl.cloneNode(true);
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const rect = svgEl.getBoundingClientRect();
      const wrapper = svgEl.closest(".recharts-wrapper") || svgEl.parentElement;
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { width: 0, height: 0 };
      const width = Number(clone.getAttribute("width")) || rect.width || wrapperRect.width || targetWidth;
      const height = Number(clone.getAttribute("height")) || rect.height || wrapperRect.height || 360;
      clone.setAttribute("width", width);
      clone.setAttribute("height", height);
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (options.inlineStyles) {
        inlineSvgStyles(svgEl, clone);
      }
      if (options.stripClip) {
        clone.querySelectorAll("[clip-path]").forEach((el) => el.removeAttribute("clip-path"));
        clone.querySelectorAll("clipPath, mask").forEach((el) => el.remove());
      }
      if (options.stripRect) {
        const rects = Array.from(clone.querySelectorAll("rect"));
        rects.forEach((r) => {
          const rw = Number(r.getAttribute("width")) || 0;
          const rh = Number(r.getAttribute("height")) || 0;
          const hasStroke = (r.getAttribute("stroke") || "").trim();
          if (!hasStroke && rw >= width * 0.9 && rh >= height * 0.9) {
            r.remove();
          }
        });
      }
      let svgString = new XMLSerializer().serializeToString(clone);
      svgString = resolveSvgVars(svgString);
      if (idPrefix) {
        const idMap = new Map();
        svgString = svgString.replace(/id="([^"]+)"/g, (match, id) => {
          const nextId = `${idPrefix}-${id}`;
          idMap.set(id, nextId);
          return `id="${nextId}"`;
        });
        idMap.forEach((nextId, id) => {
          const escaped = id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          svgString = svgString.replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${nextId})`);
          svgString = svgString.replace(new RegExp(`href="#${escaped}"`, "g"), `href="#${nextId}"`);
          svgString = svgString.replace(new RegExp(`xlink:href="#${escaped}"`, "g"), `xlink:href="#${nextId}"`);
        });
      }
      return svgString;
    } catch {
      return "";
    }
  };

  const svgToPngDataUrl = (svgEl, targetWidth = 900, idPrefix = "", options = {}) => new Promise((resolve) => {
    try {
      const svgString = serializeSvg(svgEl, targetWidth, idPrefix, options);
      if (!svgString) {
        resolve("");
        return;
      }
      const rect = svgEl.getBoundingClientRect();
      const wrapper = svgEl.closest(".recharts-wrapper") || svgEl.parentElement;
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { width: 0, height: 0 };
      const width = rect.width || wrapperRect.width || targetWidth;
      const height = rect.height || wrapperRect.height || 360;
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      const img = new Image();
      img.onload = () => {
        const ratio = width > 0 ? height / width : 0.4;
        const outWidth = targetWidth;
        const outHeight = Math.max(240, Math.round(outWidth * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outWidth, outHeight);
        try {
          ctx.drawImage(img, 0, 0, outWidth, outHeight);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = svgDataUrl;
    } catch {
      resolve("");
    }
  });

  const pickBestChartSvg = (root) => {
    const preferred = root.querySelector("svg.recharts-surface");
    if (preferred) return preferred;
    const svgs = Array.from(root.querySelectorAll("svg"));
    if (!svgs.length) return null;
    return svgs.reduce((best, el) => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const bestRect = best.getBoundingClientRect();
      const bestArea = bestRect.width * bestRect.height;
      if (area > bestArea) return el;
      const w = Number(el.getAttribute("width")) || 0;
      const h = Number(el.getAttribute("height")) || 0;
      const bestW = Number(best.getAttribute("width")) || 0;
      const bestH = Number(best.getAttribute("height")) || 0;
      if (area === bestArea && w * h > bestW * bestH) return el;
      return best;
    }, svgs[0]);
  };

  const waitForChartReady = async (node, timeoutMs = 6000) => {
    const start = Date.now();
    const content = node.querySelector(".chart-widget__content") || node;
    let stableCount = 0;
    let lastPathCount = 0;
    while (Date.now() - start < timeoutMs) {
      const svg = pickBestChartSvg(content);
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const width = rect.width || Number(svg.getAttribute("width")) || 0;
        const height = rect.height || Number(svg.getAttribute("height")) || 0;
        const isPieLike = !!(
          content.querySelector(".recharts-pie")
          || content.querySelector(".recharts-pie-sector")
          || content.querySelector("path.recharts-sector")
          || content.querySelector("path.recharts-pie-sector")
        );
        const paths = svg.querySelectorAll("path.recharts-sector, path.recharts-pie-sector");
        const pathCount = paths.length;
        const hasPaths = Array.from(paths).some((p) => (p.getAttribute("d") || "").length > 10);
        if (pathCount > 0 && pathCount === lastPathCount && hasPaths) {
          stableCount += 1;
        } else {
          stableCount = 0;
        }
        lastPathCount = pathCount;
        if (width > 0 && height > 0 && (isPieLike ? stableCount >= 2 : (pathCount === 0 || stableCount >= 2))) return true;
      }
      if (content.querySelector("table")) return true;
      await wait(80);
    }
    return false;
  };

  const forceChartRerender = async (node) => {
    const wrapper = node.querySelector(".recharts-wrapper");
    if (!wrapper) return () => {};
    const prev = { width: wrapper.style.width, height: wrapper.style.height };
    wrapper.style.width = "100%";
    wrapper.style.height = "320px";
    wrapper.getBoundingClientRect();
    window.dispatchEvent(new Event("resize"));
    await wait(140);
    window.dispatchEvent(new Event("resize"));
    await wait(140);
    return () => {
      wrapper.style.width = prev.width;
      wrapper.style.height = prev.height;
    };
  };

  const collectChartWidgets = async (filterFn) => {
    const chartNodes = Array.from(document.querySelectorAll("[data-report-chart=\"widget\"]"));
    const filtered = filterFn ? chartNodes.filter(filterFn) : chartNodes;
    const results = [];
    let chartIndex = 0;
    for (const node of filtered) {
      try {
        node.scrollIntoView({ block: "center", behavior: "instant" });
      } catch {}
      await wait(120);
      await waitForChartReady(node);
      const pinned = node.getAttribute("data-report-pinned") === "true";
      const source = node.getAttribute("data-report-source") || "auto";
      const title = node.getAttribute("data-report-title") || "Chart";
      const titleLower = title.toLowerCase();
      let restoreRerender = () => {};
      if (titleLower.includes("distribution of sub-categories")) {
        restoreRerender = await forceChartRerender(node);
        await wait(1000);
        await waitForChartReady(node, 8000);
      }
      const content = node.querySelector(".chart-widget__content") || node;
      const svg = pickBestChartSvg(content);
      const isDonut = !!(svg && (
        svg.querySelector(".recharts-pie")
        || svg.querySelector(".recharts-pie-sector")
        || svg.querySelector("path.recharts-sector")
        || svg.querySelector("path.recharts-pie-sector")
      ));
      if (isDonut) {
        await wait(1200);
      }
      const chartKey = `chart-${chartIndex}-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      chartIndex += 1;
      const svgOptions = isDonut ? { stripClip: true, stripRect: true, inlineStyles: true } : {};
      let imgDataUrl = svg ? await svgToPngDataUrl(svg, 900, chartKey, svgOptions) : "";
      if (imgDataUrl && !imgDataUrl.startsWith("data:image/png")) {
        imgDataUrl = "";
      }
      const inlineSvg = svg ? serializeSvg(svg, 900, chartKey, svgOptions) : "";
      const inlineSvgDataUrl = inlineSvg
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inlineSvg)}`
        : "";
      const inlineBlock = inlineSvg
        ? `<div class="report-chart-inline${isDonut ? " donut" : ""}"${isDonut ? ' style="height: 320px;"' : ""}>${inlineSvg}</div>`
        : "";
      let htmlFallback = "";
      if (content) {
        const clone = content.cloneNode(true);
        cleanCloneForReport(clone);
        htmlFallback = clone.innerHTML.trim();
      }
      const preferHtml = htmlFallback && !imgDataUrl && !inlineSvgDataUrl && !inlineBlock;
      results.push(`
        <div class="report-chart-card">
          <div class="report-chart-badge">${source === "custom" ? (pinned ? "User Chart - Pinned" : "User Chart") : "Pinned Chart"}</div>
          <div class="report-chart-title">${escapeHtml(title)}</div>
          ${preferHtml
            ? `<div class="report-chart-html donut" style="min-height: 320px;">${htmlFallback}</div>`
            : (isDonut && inlineBlock
              ? inlineBlock
              : (imgDataUrl
                ? `<img class="report-chart-img" src="${imgDataUrl}" alt="${escapeHtml(title)}" />`
                : (inlineSvgDataUrl
                  ? `<img class="report-chart-img report-chart-svg" src="${inlineSvgDataUrl}" alt="${escapeHtml(title)}" />`
                  : (inlineBlock
                    ? inlineBlock
                    : (htmlFallback
                      ? `<div class="report-chart-html">${htmlFallback}</div>`
                      : "<p class=\"report-empty\">Chart preview unavailable.</p>")))))}
        </div>
      `);
      restoreRerender();
    }
    return results;
  };

  const collectOverviewCards = () => {
    const root = document.querySelector("[data-report-section=\"summary-cards\"]");
    if (!root) return [];
    const labelNodes = Array.from(root.querySelectorAll("div[style*=\"text-transform: uppercase\"]"));
    const cardNodes = [];
    const seen = new Set();
    const findCardRoot = (el) => {
      let node = el;
      while (node && node !== root) {
        const style = node.getAttribute("style") || "";
        if (/border-radius/i.test(style) && (/box-shadow/i.test(style) || /border-left/i.test(style))) {
          return node;
        }
        node = node.parentElement;
      }
      return el.closest("div");
    };
    labelNodes.forEach((labelEl) => {
      const cardRoot = findCardRoot(labelEl);
      if (cardRoot && !seen.has(cardRoot)) {
        seen.add(cardRoot);
        cardNodes.push(cardRoot);
      }
    });
    const cards = cardNodes.length ? cardNodes : Array.from(root.children);
    return cards.map((card) => {
      const labelEl = card.querySelector("div[style*=\"text-transform: uppercase\"]")
        || card.querySelector("div[style*=\"text-transform\"]")
        || card.querySelector("div");
      const label = labelEl?.textContent?.trim() || "";
      const numericEls = Array.from(card.querySelectorAll("div"))
        .filter((el) => /\d/.test(el.textContent || "") && !/[a-z]/i.test(el.textContent || ""));
      const topEl = numericEls.sort((a, b) => {
        const af = parseFloat(a.style?.fontSize || "0");
        const bf = parseFloat(b.style?.fontSize || "0");
        return bf - af;
      })[0];
      const topValue = topEl?.textContent?.trim() || "";
      const countMatch = card.textContent?.match(/Top\s+(\d+)\s+ranking/i);
      const maxRows = countMatch ? parseInt(countMatch[1], 10) : 8;
      const rowLabels = Array.from(card.querySelectorAll("div")).filter((el) => el.style?.textOverflow === "ellipsis");
      const rows = rowLabels.map((labelEl) => {
        const row = labelEl.parentElement;
        const children = Array.from(row.children || []);
        const valueEl = children.length ? children[children.length - 1] : null;
        const value = valueEl ? valueEl.textContent.trim() : "";
        return { label: labelEl.textContent.trim(), value };
      }).filter((r) => r.label && r.value && r.label !== r.value);
      const uniqueRows = [];
      const seen = new Set();
      rows.forEach((r) => {
        const key = r.label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        uniqueRows.push(r);
      });
      if (!label && !topValue && uniqueRows.length === 0) return null;
      return {
        label: label || "Overview",
        topValue,
        rows: uniqueRows.slice(0, maxRows),
      };
    }).filter(Boolean);
  };

  const computeDataSummary = () => {
    const headers = data?.headers || [];
    const rows = data?.rows || [];
    if (!headers.length || !rows.length) return null;

    const parseDateValue = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const formatDateRange = (dates) => {
      if (!dates.length) return "N/A";
      const sorted = dates.slice().sort((a, b) => a - b);
      const start = sorted[0];
      const end = sorted[sorted.length - 1];
      const formatFull = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return start.getTime() === end.getTime() ? formatFull(start) : `${formatFull(start)} - ${formatFull(end)}`;
    };

    const findHeader = (patterns, fallbackPatterns = [], excludePatterns = []) => {
      const primary = headers.find((h) => (
        patterns.some((re) => re.test(String(h)))
        && !excludePatterns.some((re) => re.test(String(h)))
      ));
      if (primary) return primary;
      return headers.find((h) => (
        fallbackPatterns.some((re) => re.test(String(h)))
        && !excludePatterns.some((re) => re.test(String(h)))
      ));
    };

    let dateRange = "N/A";
    if (Array.isArray(data?.dateCols) && data.dateCols.length > 0) {
      const dateHeaders = data.dateCols.filter((h) => headers.includes(h));
      const dates = dateHeaders.map((h) => parseDateValue(h)).filter(Boolean);
      dateRange = formatDateRange(dates);
    } else {
      const dateCandidates = headers.filter((h) => /date|day|time|period/i.test(String(h)));
      let bestHeader = null;
      let bestScore = 0;
      dateCandidates.forEach((h) => {
        const idx = headers.indexOf(h);
        const sample = rows.slice(0, 120).map((r) => parseDateValue(r[idx])).filter(Boolean);
        const score = sample.length / Math.max(1, Math.min(120, rows.length));
        if (score > bestScore) {
          bestScore = score;
          bestHeader = h;
        }
      });
      if (bestHeader && bestScore >= 0.4) {
        const idx = headers.indexOf(bestHeader);
        const dates = rows.map((r) => parseDateValue(r[idx])).filter(Boolean);
        dateRange = formatDateRange(dates);
      }
    }

    const getUniqueCount = (headerName) => {
      if (!headerName) return "N/A";
      const idx = headers.indexOf(headerName);
      if (idx < 0) return "N/A";
      const values = new Set();
      rows.forEach((row) => {
        const val = row[idx];
        if (val === null || val === undefined) return;
        const str = String(val).trim();
        if (str) values.add(str);
      });
      return values.size.toLocaleString();
    };

    const participantHeader = findHeader(
      [/participant id/i, /participant/i],
      [/agent/i, /employee/i, /worker/i, /name/i, /id/i],
      [/date/i, /category/i, /site/i, /locale/i]
    ) || (data?.primaryCol && headers.includes(data.primaryCol) ? data.primaryCol : null);
    let categoryHeader = findHeader([/category/i], [/type/i, /group/i], [/sub/i]);
    if (!categoryHeader) categoryHeader = findHeader([/sub.*category/i], [/category/i], []);
    const localeHeader = findHeader([/locale/i], [/language/i, /region/i, /country/i], []);
    const siteHeader = findHeader([/site/i], [/location/i, /branch/i], []);

    return {
      totalRecords: rows.length.toLocaleString(),
      columns: headers.length.toLocaleString(),
      dateRange,
      uniqueParticipants: getUniqueCount(participantHeader),
      uniqueCategories: getUniqueCount(categoryHeader),
      uniqueLocales: getUniqueCount(localeHeader),
      uniqueSites: getUniqueCount(siteHeader),
    };
  };

  const collectActiveDateRange = () => {
    const fromSelect = document.querySelector("[data-report-date-from=\"true\"]");
    const toSelect = document.querySelector("[data-report-date-to=\"true\"]");
    if (!fromSelect || !toSelect) return "";
    const fromVal = fromSelect.value;
    const toVal = toSelect.value;
    const collectDefaultRange = () => {
      const opts = Array.from(fromSelect.options || [])
        .map((o) => ({ value: o.value, text: (o.textContent || "").trim() }))
        .filter((o) => o.value && o.value !== "all" && o.text);
      if (!opts.length) return "";
      const start = opts[0]?.text;
      const end = opts[opts.length - 1]?.text;
      if (start && end) return `${start} - ${end}`;
      return start || "";
    };
    if (!fromVal || !toVal || fromVal === "all" || toVal === "all") {
      return collectDefaultRange();
    }
    const fromText = fromSelect.selectedOptions?.[0]?.textContent?.trim() || fromVal;
    const toText = toSelect.selectedOptions?.[0]?.textContent?.trim() || toVal;
    if (fromText === toText) return fromText;
    return `${fromText} - ${toText}`;
  };

  const collectCompareCards = () => {
    const root = document.querySelector("[data-report-section=\"compare-cards\"]");
    if (!root) return null;
    const activeModeBtn = root.querySelector("[data-report-compare-mode-button=\"true\"][data-report-active=\"true\"]");
    const activeMode = activeModeBtn?.getAttribute("data-report-compare-mode") || "";
    const dateASelect = root.querySelector("[data-report-compare-date=\"A\"]");
    const dateBSelect = root.querySelector("[data-report-compare-date=\"B\"]");
    const rowsNote = root.querySelector("[data-report-compare-rows=\"true\"]");
    const dateA = dateASelect?.selectedOptions?.[0]?.textContent?.trim() || "";
    const dateB = dateBSelect?.selectedOptions?.[0]?.textContent?.trim() || "";
    const rowsInfo = rowsNote?.textContent?.trim() || "";
    const cards = Array.from(root.querySelectorAll("[data-report-compare-card=\"true\"]"))
      .map((el) => ({
        label: el.getAttribute("data-report-compare-label") || "",
        valueA: el.getAttribute("data-report-compare-a") || "",
        valueB: el.getAttribute("data-report-compare-b") || "",
        delta: el.getAttribute("data-report-compare-delta") || "",
      }))
      .filter((card) => card.label && (card.valueA || card.valueB));
    return { dateA, dateB, rowsInfo, cards, mode: activeMode };
  };

  const getLogoDataUrl = async () => {
    try {
      const response = await fetch(lifewoodIconText);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return lifewoodIconText;
    }
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const CSS_VAR_MAP = {
    "--color-text": "#122019",
    "--color-text-light": "#6b7a71",
    "--color-border": "#e0e6e1",
    "--color-surface": "#ffffff",
    "--color-surface-elevated": "#ffffff",
    "--color-surface-soft": "#f6faf7",
    "--color-castleton-green": "#2d6a4f",
    "--color-dark-serpent": "#133020",
    "--color-saffron": "#f4b860",
    "--color-grid": "#dfe7e2",
    "--color-chart-axis": "#97a59c",
    "--color-shadow-soft": "0 10px 22px rgba(0,0,0,0.06)",
    "--color-chip-bg": "#f2f7f3",
    "--color-bg": "#ffffff",
  };

  const replaceCssVars = (html) => html.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (match, varName) => (
    CSS_VAR_MAP[varName] || match
  ));

  const buildReportHtml = ({ title, sheet, logoDataUrl, overviewCards, overviewDateRange, compareData, dataSummary, aiBlocks, userCharts, pinnedCharts, exportedAt, exportMode = "pdf" }) => {
    const safeTitle = escapeHtml(title || "Workbook Report");
    const safeFile = escapeHtml(title || "Untitled workbook");
    const safeSheet = escapeHtml(sheet || "Sheet1");
    const timestamp = exportedAt || new Date().toLocaleString();
    const normalizeLabel = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const parseNumeric = (text) => {
      if (!text) return NaN;
      const raw = String(text).replace(/,/g, "").trim();
      const mult = /[kK]$/.test(raw) ? 1000 : /[mM]$/.test(raw) ? 1000000 : 1;
      const cleaned = raw.replace(/[kKmM%]/g, "");
      const num = parseFloat(cleaned);
      if (Number.isNaN(num)) return NaN;
      return num * mult;
    };
    const renderOverviewCard = (card) => {
      if (!card) return "";
      const rowsHtml = (card.rows || []).map((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `
          <tr>
            <td style="width: 28px; font-size: 13px;">${medal}</td>
            <td style="font-size: 13px; color: #1a1a1a;">${escapeHtml(r.label)}</td>
            <td class="rank-value" style="width: 40px; text-align: right; white-space: nowrap; word-break: keep-all; font-weight: 600; font-size: 14px;">${escapeHtml(r.value)}</td>
          </tr>
        `;
      }).join("");
      return `
        <div>
          <div style="display: table; width: 100%; margin-bottom: 8px;">
            <div style="display: table-cell; vertical-align: top;">
              <div style="font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">
                ${escapeHtml(card.label)}
              </div>
              <div style="font-size: 11px; color: #aaa; margin-top: 2px;">Top ${(card.rows || []).length} ranking</div>
            </div>
            <div class="overview-top" style="display: table-cell; text-align: right; font-size: 28px; font-weight: 700; color: #1a1a1a; white-space: nowrap; word-break: keep-all;">
              ${escapeHtml(card.topValue || "")}
            </div>
          </div>
          <div style="height: 1px; background: #e0e0e0; margin: 8px 0 10px;"></div>
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            ${rowsHtml}
          </table>
        </div>
      `;
    };
    const overviewRangeNote = overviewDateRange ? `<div class="report-subtitle">Date Range: ${escapeHtml(overviewDateRange)}</div>` : "";
    const overviewHtml = overviewCards.length
      ? (() => {
          const cards = overviewCards.map((c) => ({ ...c }));
          const pullMatch = (needle) => {
            const idx = cards.findIndex((c) => normalizeLabel(c.label).includes(normalizeLabel(needle)));
            if (idx === -1) return null;
            return cards.splice(idx, 1)[0];
          };
          const ordered = [];
          const left = pullMatch("total count of item/asset");
          const right = pullMatch("unique sites");
          if (left || right) {
            ordered.push(left || cards.shift() || null);
            ordered.push(right || cards.shift() || null);
          }
          ordered.push(...cards);
          const rows = [];
          for (let i = 0; i < ordered.length; i += 2) {
            const a = renderOverviewCard(ordered[i]);
            const b = renderOverviewCard(ordered[i + 1]);
            if (a && !b) {
              rows.push(`
                <tr>
                  <td colspan="2" style="width: 100%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${a}</td>
                </tr>
              `);
            } else {
              rows.push(`
                <tr>
                  <td style="width: 50%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${a}</td>
                  <td style="width: 50%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${b}</td>
                </tr>
              `);
            }
          }
          return `
            <table style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 12px 0;">
              ${rows.join("")}
            </table>
          `;
        })()
      : "<p class=\"report-empty\">No overview data available yet.</p>";
    const compareSection = compareData && compareData.cards && compareData.cards.length
      ? (() => {
          const metaParts = [];
          if (compareData.dateA) metaParts.push(`Period A: ${escapeHtml(compareData.dateA)}`);
          if (compareData.dateB) metaParts.push(`Period B: ${escapeHtml(compareData.dateB)}`);
          if (compareData.rowsInfo) metaParts.push(escapeHtml(compareData.rowsInfo));
          const metaLine = metaParts.length ? `<div class="report-subtitle">${metaParts.join(" · ")}</div>` : "";
          const mode = (compareData.mode || "").toLowerCase();
          const modeLabel = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "";
          const modeLine = modeLabel ? `<div class="compare-mode-row"><span class="compare-mode-pill active">${modeLabel}</span></div>` : "";
          const rows = [];
          for (let i = 0; i < compareData.cards.length; i += 2) {
            const left = compareData.cards[i];
            const right = compareData.cards[i + 1];
            const renderCompareCard = (card) => {
              if (!card) return "";
              const delta = card.delta ? `<div class="compare-delta">${escapeHtml(card.delta)}</div>` : "";
              return `
                <div>
                  <div class="compare-card-title">${escapeHtml(card.label)}</div>
                  <div class="compare-values">
                    <div>
                      <div class="compare-label">Period A</div>
                      <div class="compare-value compare-a">${escapeHtml(card.valueA)}</div>
                    </div>
                    <div>
                      <div class="compare-label">Period B</div>
                      <div class="compare-value compare-b">${escapeHtml(card.valueB)}</div>
                    </div>
                  </div>
                  ${delta}
                </div>
              `;
            };
            if (left && !right) {
              rows.push(`
                <tr>
                  <td colspan="2" style="width: 100%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${renderCompareCard(left)}</td>
                </tr>
              `);
            } else {
              rows.push(`
                <tr>
                  <td style="width: 50%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${renderCompareCard(left)}</td>
                  <td style="width: 50%; vertical-align: top; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">${renderCompareCard(right)}</td>
                </tr>
              `);
            }
          }
          return `
            ${modeLine}
            ${metaLine}
            <table style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 12px 0; margin-top: 8px;">
              ${rows.join("")}
            </table>
          `;
        })()
      : "<p class=\"report-empty\">No comparison data available for this report.</p>";
    const aiSection = aiBlocks.length
      ? aiBlocks.join("")
      : "<p class=\"report-empty\">No AI responses available yet.</p>";
    const chartNote = `
      <div class="report-notice">
        <span class="report-notice-icon">ℹ</span>
        <div>No charts were added to this report. Pin charts from the Charts page to include them here.</div>
      </div>
    `;
    const chartBlocks = [];
    if (userCharts.length) chartBlocks.push(userCharts.join(""));
    if (pinnedCharts.length) chartBlocks.push(pinnedCharts.join(""));
    const showCharts = chartBlocks.length > 0;
    let chartSection = showCharts ? chartBlocks.join("") : chartNote;
    if (exportMode === "doc") {
      chartSection = chartSection.replaceAll(
        'class="report-chart-img"',
        'class="report-chart-img" width="624" style="width: 6.5in; max-width: 6.5in; height: auto; display: block; margin: 0 auto; border: 0;"'
      );
    }
    const summaryRows = dataSummary
      ? (() => {
          const rows = [
            ["Total Records", dataSummary.totalRecords],
            ["Columns", dataSummary.columns],
            ["Date Range", dataSummary.dateRange],
            ["Unique Participants", dataSummary.uniqueParticipants],
            ["Unique Categories", dataSummary.uniqueCategories],
            ["Unique Locales", dataSummary.uniqueLocales],
            ["Unique Sites", dataSummary.uniqueSites],
          ];
          const body = rows.map((row, idx) => `
            <tr class="${idx % 2 === 0 ? "row-alt" : ""}">
              <td class="summary-label">${row[0]}</td>
              <td class="summary-value">${row[1]}</td>
            </tr>
          `).join("");
          return `
            <table class="report-summary">${body}</table>
            <div class="report-note"><em>Full dataset is available in the source file.</em></div>
          `;
        })()
      : "<p class=\"report-empty\">No data summary available for this report.</p>";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --color-text: #122019;
      --color-text-light: #6b7a71;
      --color-border: #e0e6e1;
      --color-surface: #ffffff;
      --color-surface-elevated: #ffffff;
      --color-surface-soft: #f6faf7;
      --color-castleton-green: #2d6a4f;
      --color-dark-serpent: #133020;
      --color-saffron: #f4b860;
      --color-grid: #dfe7e2;
      --color-chart-axis: #97a59c;
      --color-shadow-soft: 0 10px 22px rgba(0,0,0,0.06);
      --color-chip-bg: #f2f7f3;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: "Manrope", "Segoe UI", Arial, sans-serif; color: #122019; background: #ffffff; }
    h1 { font-size: 22px; margin: 6px 0 12px; }
    h2 { font-size: 16px; margin: 0 0 8px; font-weight: 600; color: #1a1a1a; }
    .report-wrap { max-width: 1020px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 26px 30px 30px; box-shadow: 0 18px 38px rgba(0,0,0,0.08); border: 1px solid #e4ece6; }
    .report-wrap * { word-break: break-word; }
    .report-header-flex { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e4ece6; padding-bottom: 12px; margin-bottom: 10px; }
    .report-header { width: 100%; border-bottom: 1px solid #e4ece6; margin-bottom: 10px; display: none; }
    .report-header td { vertical-align: top; padding-bottom: 14px; }
    .report-brand { display: block; }
    .report-logo { width: 140px; height: auto; object-fit: contain; }
    .report-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #edf5ef; color: #2d6a4f; font-weight: 700; font-size: 11px; }
    .report-meta { display: grid; gap: 6px; margin-top: 8px; font-size: 12px; color: #4b5a52; }
    .report-title { page-break-after: avoid; }
    .report-section { margin-top: 24px; page-break-inside: avoid; }
    .report-subtitle { font-size: 12px; color: #6b7a71; margin: 8px 0 6px; }
    .workbook-overview { page-break-after: avoid; page-break-inside: avoid; }
    .data-summary { page-break-before: avoid; }
    .report-section hr { border: none; border-bottom: 1px solid #e0e0e0; margin: 8px 0 0; }
    .report-block { margin-top: 14px; }
    .report-ai-message { border: 1px solid #e1e7e2; border-radius: 14px; padding: 12px 14px; margin-bottom: 12px; background: #fafcfb; font-size: 13px; line-height: 1.6; color: #122019; }
    .report-ai-user { background: #f1f6f3; border-color: #d9e6de; }
    .report-ai-message table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .report-ai-message th, .report-ai-message td { padding: 6px 10px; border-bottom: 1px solid rgba(19,48,32,0.08); text-align: left; }
    .report-empty { font-size: 12px; color: #6b7a71; margin: 8px 0 0; }
    .report-note { font-size: 12px; color: #6b7a71; margin-top: 8px; font-style: italic; }
    .report-summary { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #e0e0e0; }
    .report-summary td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 12px; }
    .report-summary .row-alt { background: #f9f9f9; }
    .summary-label { color: #6b6b6b; width: 55%; }
    .summary-value { font-weight: 700; }
    .compare-mode-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0 6px; }
    .compare-mode-pill { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid #e0e0e0; color: #4b5a52; background: #f6faf7; }
    .compare-mode-pill.active { background: #2d6a4f; color: #fff; border-color: #2d6a4f; }
    .compare-card-title { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
    .compare-values { display: flex; gap: 14px; align-items: flex-end; margin-bottom: 8px; flex-wrap: wrap; }
    .compare-label { font-size: 9px; font-weight: 700; margin-bottom: 2px; color: #8a9a92; }
    .compare-value { font-size: 20px; font-weight: 800; }
    .compare-a { color: #046241; }
    .compare-b { color: #ffb347; }
    .compare-delta { font-size: 11px; font-weight: 700; color: #2f7a56; }
    .report-chart-card { border: 1px solid #e0e6e1; border-radius: 14px; overflow: hidden; margin-bottom: 16px; background: #fff; }
    .report-chart-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2d6a4f; background: #edf5ef; padding: 6px 10px; }
    .report-chart-title { font-size: 13px; font-weight: 800; padding: 10px 12px; border-bottom: 1px solid #e0e6e1; color: #122019; }
    .report-chart-img { width: 100%; max-width: 900px; display: block; margin: 0 auto; border-top: 1px solid #f0f4f1; }
    .report-chart-html { padding: 10px 12px; overflow: hidden; }
    .report-chart-html table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .report-chart-html th, .report-chart-html td { border-bottom: 1px solid #e0e6e1; padding: 6px 8px; text-align: left; }
    .report-chart-html.donut .recharts-wrapper { width: 100% !important; height: 320px !important; }
    .report-chart-html.donut svg { width: 100% !important; height: 100% !important; display: block; }
    .report-chart-html.donut .recharts-surface { width: 100% !important; height: 100% !important; }
    .report-chart-html.donut .recharts-legend-wrapper { position: static !important; margin-top: 8px; }
    .report-chart-inline { padding: 10px 12px; }
    .report-chart-inline svg { width: 100%; height: auto; display: block; }
    .report-chart-inline.donut svg { width: 100%; height: 100%; }
    .rank-value { white-space: nowrap; word-break: keep-all; overflow: visible; min-width: 40px; text-align: right; font-size: 14px; font-weight: 600; }
    .overview-top { white-space: nowrap; word-break: keep-all; }
    .report-notice { background: #f5f5f5; border: 1px solid #d0d0d0; border-radius: 8px; padding: 12px; display: flex; gap: 10px; align-items: flex-start; color: #555; font-size: 12px; }
    .report-notice-icon { font-weight: 700; }
    .report-footer { margin-top: 18px; font-size: 11px; color: #6b6b6b; text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e0e6e1; padding: 6px 8px; font-size: 11px; text-align: left; }
    .report-section, .report-block, .report-ai-message, .report-chart-card, .report-summary { page-break-inside: avoid; }
    @media print {
      h1, h2, .report-title { page-break-after: avoid; }
      .report-section, .overview-cards, .report-summary { page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-section { margin-top: 24px; }
      .overview-cards { display: table; width: 100%; }
      .overview-cell { display: table-cell; width: 48%; vertical-align: top; }
      .report-header-flex { display: none; }
      .report-header { display: table; }
      input, button, select, [role="button"],
      .sort-icon, .filter-row, .pagination,
      .progress-bar, .bar-track, .bar-fill,
      .hide-selected, .unhide-all,
      .page-size-control,
      [class*="progress"], [class*="bar-"] { display: none !important; }
      @page { counter-increment: page; }
      .page-number::after { content: "Page " counter(page); }
    }
    .doc-export .report-wrap { max-width: none; width: 100%; box-shadow: none; }
    .doc-export .report-header-flex { display: none !important; }
    .doc-export .report-header { display: table !important; }
    .doc-export .compare-mode-row { display: block; }
    .doc-export .compare-mode-pill { display: inline-block; margin-right: 8px; }
    .doc-export .report-chart-card { overflow: visible; }
    .doc-export .report-chart-img { max-width: 100% !important; width: 100% !important; height: auto !important; }
  </style>
</head>
<body class="${exportMode === "doc" ? "doc-export" : ""}">
  <div class="report-wrap">
    ${exportMode === "doc" ? "" : `
    <div class="report-header-flex">
      <div class="report-brand">
        <img class="report-logo" src="${logoDataUrl}" alt="Lifewood" />
      </div>
      <div style="text-align: right;">
        <div class="report-chip">Generated Report</div>
        <div class="report-meta">
          <div><strong>File:</strong> ${safeFile}</div>
          <div><strong>Sheet:</strong> ${safeSheet}</div>
          <div><strong>Exported:</strong> ${timestamp}</div>
        </div>
      </div>
    </div>
    `}
    <table class="report-header">
      <tr>
        <td>
          <div class="report-brand">
            <img class="report-logo" src="${logoDataUrl}" alt="Lifewood" />
          </div>
        </td>
        <td style="text-align: right;">
          <div class="report-chip">Generated Report</div>
          <div class="report-meta">
            <div><strong>File:</strong> ${safeFile}</div>
            <div><strong>Sheet:</strong> ${safeSheet}</div>
            <div><strong>Exported:</strong> ${timestamp}</div>
          </div>
        </td>
      </tr>
    </table>
    <h1 class="report-title">${safeTitle}</h1>

    <div class="report-section workbook-overview">
      <h2>Workbook Overview</h2>
      <hr />
      ${overviewRangeNote}
      ${overviewHtml}
    </div>

    <div class="report-section compare-periods">
      <h2>Compare Periods</h2>
      <hr />
      ${compareSection}
    </div>

    <div class="report-section data-summary">
      <h2>Data Summary</h2>
      <hr />
      ${summaryRows}
    </div>

    <div class="report-section">
      <h2>AI Analysis</h2>
      <hr />
      ${aiSection}
    </div>

    <div class="report-section">
      <h2>Charts</h2>
      <hr />
      ${chartSection}
    </div>
    <div class="report-footer">Exported: ${timestamp} · <span class="page-number"></span></div>
  </div>
</body>
</html>`;
  };

  const downloadFile = (content, fileBase, mimeType, ext) => {
    const safeBase = (fileBase || "Workbook Report").replace(/[\\/:*?"<>|]+/g, "-");
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeBase}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportReport = async (format) => {
    if (reportExporting) return;
    setReportExporting(true);
    try {
      if (reportOpen) {
        setReportOpen(false);
        await wait(200);
      }
      const activeTab = document.querySelector("[data-report-tab][data-report-active=\"true\"]")?.getAttribute("data-report-tab");
      const homeTabButton = document.querySelector("[data-report-tab=\"home\"]");
      const chartTabButton = document.querySelector("[data-report-tab=\"charts\"]");
      const homeWasInactive = activeTab !== "home";

      const chatToggle = document.querySelector("button[title=\"Ask about your data\"]");
      const chatPanel = document.querySelector(".fixed.bottom-24.right-6");
      const chatWasOpen = !!chatPanel;

      if (!chatWasOpen && chatToggle) {
        chatToggle.click();
        await wait(160);
      }

      const reportChatPanel = document.querySelector(".fixed.bottom-24.right-6");
      let aiBlocks = collectAssistantMessages(reportChatPanel);
      if (!aiBlocks.length) {
        aiBlocks = [`
          <div class="report-notice">
            <span class="report-notice-icon">ℹ</span>
            <div>No AI analysis was conducted in this session. Ask the AI agent questions to include insights in your report.</div>
          </div>
        `];
      }
      let overviewCards = [];
      if (homeWasInactive && homeTabButton) {
        homeTabButton.click();
        await wait(240);
      }
      overviewCards = collectOverviewCards();
      const overviewDateRange = collectActiveDateRange();
      let compareData = collectCompareCards();
      const compareInitiallyOpen = !!compareData;
      if (!compareInitiallyOpen) {
        const compareToggle = document.querySelector("[data-report-toggle=\"compare-periods\"]");
        if (compareToggle) {
          compareToggle.click();
          await wait(240);
          compareData = collectCompareCards();
        }
      }

      if (chartTabButton) {
        chartTabButton.click();
        await wait(1200);
        // Let the charts finish animating before capture
        await wait(2200);
      }

      const userCharts = await collectChartWidgets((node) => node.getAttribute("data-report-source") === "custom");
      const pinnedCharts = await collectChartWidgets((node) => (
        node.getAttribute("data-report-pinned") === "true" && node.getAttribute("data-report-source") !== "custom"
      ));
      const dataSummary = computeDataSummary();
      const overviewRange = overviewDateRange || dataSummary?.dateRange || "";
      const logoDataUrl = await getLogoDataUrl();
      const reportHtml = buildReportHtml({
        title: fileName || "Workbook Report",
        sheet: activeSheetName,
        logoDataUrl,
        overviewCards,
        overviewDateRange: overviewRange,
        compareData,
        dataSummary,
        aiBlocks,
        userCharts,
        pinnedCharts,
        exportedAt: new Date().toLocaleString(),
        exportMode: format === "pdf" ? "pdf" : "doc",
      });

      if (!compareInitiallyOpen) {
        const compareToggle = document.querySelector("[data-report-toggle=\"compare-periods\"]");
        if (compareToggle) compareToggle.click();
      }
      if (activeTab && activeTab !== "charts") {
        const returnTab = document.querySelector(`[data-report-tab=\"${activeTab}\"]`);
        returnTab?.click();
      }
      if (!chatWasOpen && chatToggle) {
        chatToggle.click();
      }

      if (format === "pdf") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(reportHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
        }
      } else {
        downloadFile(reportHtml, `Report - ${fileName || "Workbook"}`, "application/msword", "doc");
      }
    } finally {
      setReportExporting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <style>{`
        .report-button {
          background: #2d6a4f;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          padding: 8px 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(4, 98, 65, 0.2);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .report-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(4, 98, 65, 0.28);
          background: #2f7a56;
        }
        .report-button:disabled {
          cursor: default;
          opacity: 0.6;
          box-shadow: none;
        }
        .report-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(12, 18, 16, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          animation: report-fade 0.18s ease;
        }
        .report-modal-panel {
          width: min(640px, 92vw);
          background: var(--color-surface-elevated);
          border-radius: 18px;
          padding: 18px 20px 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
          border: 1px solid var(--color-border);
          animation: report-rise 0.22s ease;
        }
        .report-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .report-modal-kicker {
          font-size: 10px;
          letter-spacing: 0.16em;
          font-weight: 800;
          text-transform: uppercase;
          color: #8b9891;
        }
        .report-modal-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--color-text);
        }
        .report-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: #fff;
          cursor: pointer;
          font-size: 18px;
          color: #6b7a71;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .report-modal-close:hover {
          transform: translateY(-1px);
          border-color: #2d6a4f;
          box-shadow: 0 6px 16px rgba(4, 98, 65, 0.18);
        }
        .report-modal-meta {
          display: grid;
          gap: 6px;
          margin: 10px 0 16px;
          font-size: 12px;
          color: var(--color-text);
          background: #f6faf7;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 10px 12px;
        }
        .report-modal-label {
          display: inline-block;
          min-width: 46px;
          font-weight: 700;
          color: #5b6b62;
          margin-right: 6px;
        }
        .report-modal-desc {
          font-size: 12px;
          color: var(--color-text-light);
          margin: 6px 0 10px;
          line-height: 1.5;
        }
        .report-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 8px 0 14px;
        }
        .report-pill {
          padding: 4px 10px;
          border-radius: 999px;
          background: #e2f2d9;
          color: #2f6b47;
          font-size: 11px;
          font-weight: 700;
        }
        .report-format-stack {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
        }
        .report-format-btn {
          width: 100%;
          padding: 16px 18px;
          border: none;
          background: var(--color-surface);
          color: var(--color-text);
          font-weight: 700;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          transition: background-color 0.16s ease;
        }
        .report-format-btn:hover {
          background: #f4fbf7;
        }
        .report-format-btn:disabled {
          cursor: default;
          opacity: 0.65;
        }
        .report-format-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: transparent;
          color: #2d6a4f;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.06em;
          font-size: 12px;
        }
        .report-format-icon img {
          width: 36px;
          height: 36px;
          object-fit: contain;
          background: transparent;
          mix-blend-mode: multiply;
        }
        .report-format-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--color-text);
        }
        .report-format-subtitle {
          font-size: 12px;
          color: var(--color-text-light);
          margin-top: 2px;
        }
        .report-format-chip {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: #e7eefb;
          color: #2a4c8b;
        }
        .report-format-chip.pdf {
          background: #fdecea;
          color: #9b3b2f;
        }
        .report-format-split {
          border-left: 1px solid var(--color-border);
        }
        @keyframes report-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes report-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <aside
        className="ui-auto-hide-sidebar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "var(--sidebar-width)",
          height: "100vh",
          zIndex: 60,
          background: "var(--color-surface)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        <Sidebar
          folder={{ name: fileName }}
          files={[]}
          filesLoading={switching}
          onSelectFolder={null}
          onRefresh={refreshDashboard}
          onBack={() => navigate("/")}
        />
      </aside>

      <div style={{ marginLeft: "var(--sidebar-offset)", width: "calc(100% - var(--sidebar-offset))", minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden", paddingTop: 56 }}>
        {/* Top bar */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "var(--sidebar-offset)",
            right: 0,
            height: 56,
            zIndex: 55,
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            boxShadow: "var(--color-shadow-soft)",
          }}
        >
          <div
            className="flex items-center gap-4"
            style={{ maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "8px 24px", height: "100%" }}
          >
            <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
              <div className="flex items-center gap-2 min-w-0">
                <img src={lifewoodIconSquared} alt="Workbook" className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {fileName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: "auto" }}>
              {/* Sheet switcher - full dropdown when multiple sheets */}
              {allSheets.length > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                  <label
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: "var(--color-text)" }}
                  >
                    Sheet
                  </label>
                  <select
                    value={currentSheet}
                    onChange={(e) => switchSheet(e.target.value)}
                    disabled={switching}
                    className="px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 cursor-pointer disabled:opacity-60"
                    style={{
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      backgroundColor: "var(--color-surface-elevated)",
                    }}
                  >
                    {allSheets.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {switching && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-castleton-green)" }}>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {switchError && <span className="text-xs" style={{ color: "var(--color-saffron)" }}>{switchError}</span>}
                </div>
              )}

              <button className="report-button" onClick={() => setReportOpen(true)}>
                Generate Report
              </button>
            </div>
          </div>
        </div>

        <Dashboard data={data} blueprint={blueprint} fileId={driveFileId} />

        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-24 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-castleton-green)",
              color: "#fff",
              boxShadow: "0 10px 25px rgba(4, 98, 65, 0.25)",
            }}
            title="Back to top"
          >
            ^
          </button>
        )}
      </div>

      {reportOpen && (
        <div className="report-modal-backdrop" onClick={() => setReportOpen(false)}>
          <div className="report-modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div>
                <div className="report-modal-kicker">Export</div>
                <div className="report-modal-title">Generate Report</div>
              </div>
              <button className="report-modal-close" aria-label="Close" onClick={() => setReportOpen(false)}>
                x
              </button>
            </div>
            <div className="report-modal-meta">
              <div><span className="report-modal-label">File:</span>{fileName || "Untitled workbook"}</div>
              <div><span className="report-modal-label">Sheet:</span>{activeSheetName}</div>
            </div>
            <div className="report-modal-desc">Report will include:</div>
            <div className="report-pill-row">
              <span className="report-pill">Workbook Overview</span>
              <span className="report-pill">Compare Periods</span>
              <span className="report-pill">Data Summary</span>
              <span className="report-pill">AI Analysis</span>
              <span className="report-pill">Charts</span>
            </div>
            <div className="report-modal-desc" style={{ marginBottom: 10, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Choose export format
            </div>
            <div className="report-format-stack">
              <button className="report-format-btn" onClick={() => handleExportReport("docx")} disabled={reportExporting}>
                <div className="report-format-icon">
                  <img
                    alt="DOCX"
                    src={docxFileIcon}
                  />
                </div>
                <div>
                  <div className="report-format-title">Export as DOCX</div>
                </div>
                <span className="report-format-chip">.docx</span>
              </button>
              <button className="report-format-btn report-format-split" onClick={() => handleExportReport("pdf")} disabled={reportExporting}>
                <div className="report-format-icon">
                  <img
                    alt="PDF"
                    src={pdfFileIcon}
                  />
                </div>
                <div>
                  <div className="report-format-title">Export as PDF</div>
                </div>
                <span className="report-format-chip pdf">.pdf</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
