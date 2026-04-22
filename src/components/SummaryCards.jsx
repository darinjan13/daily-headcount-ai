import { useMemo } from "react";

const LW = {
  dark: "var(--color-text)",
  green: "var(--color-castleton-green)",
  saffron: "var(--color-saffron)",
};

const UI = {
  elevated: "var(--color-surface-elevated)",
  border: "var(--color-border)",
  borderStrong: "var(--color-border-strong)",
  text: "var(--color-text)",
  textLight: "var(--color-text-light)",
};

const KPI = {
  cardBg: "var(--kpi-card-bg)",
  popoverBg: "var(--kpi-popover-bg)",
  mutedText: "var(--kpi-muted-text)",
  divider: "var(--kpi-divider)",
  track: "var(--kpi-track)",
  trackStrong: "var(--kpi-track-strong)",
  badgeBg: "var(--kpi-badge-bg)",
  panelBg: "var(--kpi-panel-bg)",
  miniTrack: "var(--kpi-mini-track)",
  miniFill: "var(--kpi-mini-fill)",
  shadow: "var(--kpi-popover-shadow)",
};

const ACCENTS = [LW.green, LW.dark, LW.saffron, "#417256", "#034E34"];
const TOP_BADGES = ["1", "2", "3"];
const DASH = "-";

const titleCase = (value = "") => String(value)
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .split(" ")
  .filter(Boolean)
  .map((word) => {
    if (/^[A-Z0-9%]+$/.test(word) && word.length <= 4) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  })
  .join(" ");

const cleanCardLabel = (label = "") => {
  const words = titleCase(label).split(" ").filter(Boolean);
  return words
    .filter((word, index) => word.toLowerCase() !== words[index - 1]?.toLowerCase())
    .join(" ");
};

const normalizeNumber = (value) => {
  const numeric = Number(String(value ?? "").replace(/,/g, "").replace("%", ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

const looksDateLike = (value) => {
  if (value == null || value === "") return false;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  const text = String(value).trim();
  if (!text || /^\d+(\.\d+)?$/.test(text)) return false;
  return !Number.isNaN(Date.parse(text));
};

const formatRankLabel = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  return String(value ?? DASH).trim() || DASH;
};

const fmt = (value, hint) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return DASH;
  let safeHint = hint;
  const numeric = Number(value);
  if ((safeHint === "percent" || safeHint === "percent_decimal") && Math.abs(numeric) >= 2) safeHint = "number";
  if (safeHint === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
  }
  if (safeHint === "percent") return `${numeric.toFixed(1)}%`;
  if (safeHint === "percent_decimal") return `${(numeric * 100).toFixed(1)}%`;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`;
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return numeric % 1 === 0 ? numeric.toLocaleString() : numeric.toFixed(2);
};

const columnSample = (data, col, limit = 500) => data
  .slice(0, limit)
  .map((row) => row[col])
  .filter((value) => !isBlank(value));

const isIdLikeColumn = (col) => {
  const lower = col.toLowerCase();
  return /(^|[\s_-])(id|uuid|guid|record id|row id|serial|sr no|transaction id|image id|file id)([\s_-]|$)/i.test(lower)
    || /(participant id|recordid|userid|user id|employee id|person id|number)$/i.test(lower);
};

const isNameLikeColumn = (col) => /(name|employee|staff|agent|person|worker|member|operator|annotator|assignee|drummer|delivered by|uploaded by|created by|handled by|assigned to|user)$/i.test(col);
const isOrgLikeColumn = (col) => /(site|team|section|department|region|country|branch|category|client|project|shift|state|location|group|area)/i.test(col);
const isContentLikeColumn = (col) => /(platform|channel|job|type|status|remark|quality|qa|task|work|drummer|product|menu|language|device|category|sub-category|campaign|source|medium)/i.test(col);
const isWeakHeadlineColumn = (col) => /(status|state|qa|remark|site|location|flag|complete|completion)/i.test(col);
const isQualitySignalColumn = (col = "") => /(qa|quality|remark|reject|rejected|recheck|rechecked|printed|complete|completion|status|state)/i.test(col);
const isFileLikeColumn = (col = "") => /(file name|filename|image id|file id|unique identifier|uuid|guid)/i.test(col);
const isSequenceLikeColumn = (col = "") => /(grouping|group no|group number|sequence|seq|index|order|position|rank|serial|identifier|no$|number$)/i.test(col);

const familyForColumn = (col = "") => {
  const lower = col.toLowerCase();
  if (/(language|locale|translation)/i.test(lower)) return "language";
  if (/(device|phone|browser|os|model)/i.test(lower)) return "device";
  if (/(qa|quality|remark|reject|rejected|recheck|rechecked|printed|complete|completion|status|state)/i.test(lower)) return "quality";
  if (/(checked by|checker|qa by|reviewed by|verified by|approved by|audited by)/i.test(lower)) return "reviewer";
  if (/(username|user name|user)$/i.test(lower)) return "account";
  if (/(name|employee|staff|agent|person|worker|member|operator|annotator|assignee|drummer|delivered by|uploaded by|created by|handled by|assigned to)/i.test(lower)) return "identity";
  if (/(platform|channel|social|source|medium)/i.test(lower)) return "platform";
  if (/(job|task|work|type|campaign|project|client|product|menu|category|sub-category|description)/i.test(lower)) return "work";
  if (/(team|site|section|department|region|country|branch|location|group|area)/i.test(lower)) return "org";
  if (/(date|day|week|month|period|uploaded|created|modified)/i.test(lower)) return "date";
  return lower.replace(/[^a-z0-9]+/g, " ").trim().split(" ")[0] || "other";
};

const familyPriority = (family) => ({
  identity: 95,
  reviewer: 92,
  platform: 90,
  language: 88,
  work: 86,
  device: 82,
  quality: 80,
  account: 62,
  org: 64,
  date: 48,
}[family] || 50);

const columnPreference = (col = "") => {
  const lower = col.toLowerCase();
  let score = familyPriority(familyForColumn(col));
  if (/(^|\\s)(name|drummer name|employee name|person name|staff name)(\\s|$)/i.test(lower)) score += 18;
  if (/checked by|checker|qa by|delivered by/i.test(lower)) score += 12;
  if (/language|platform|category|sub-category|device|quality|reject|recheck|printed/i.test(lower)) score += 12;
  if (/username|user id|userid/i.test(lower)) score -= 18;
  if (isFileLikeColumn(col) || isIdLikeColumn(col)) score -= 80;
  if (isWeakHeadlineColumn(col) && !isQualitySignalColumn(col)) score -= 18;
  return score;
};

const isCountLikeCard = (card = {}) => {
  const text = `${card.label || ""} ${card.column || ""}`.toLowerCase();
  const countWords = /\b(posts?|records?|entries|rows|processed|transactions?|tickets?|items?)\b/.test(text);
  const numericMetricWords = /\b(time|hour|minute|min|duration|cost|price|amount|asset|link|plan|actual|balance|rate|percent|score|rework|annotation)\b/.test(text);
  return countWords && !numericMetricWords;
};

const effectiveAggregation = (card = {}) => (
  card.aggregation === "count" || card.aggregation === "distinct_count" || isCountLikeCard(card)
    ? "count"
    : (card.aggregation || "sum")
);

const isDateLikeColumn = (data, col) => {
  const sample = columnSample(data, col);
  if (!sample.length) return false;
  const dateRatio = sample.filter(looksDateLike).length / sample.length;
  return /(date|day|week|month|period|uploaded|created|modified)/i.test(col) ? dateRatio >= 0.25 : dateRatio >= 0.65;
};

const isUsefulDimension = (data, col, metricCol) => {
  if (col === metricCol || isIdLikeColumn(col)) return false;
  const sample = columnSample(data, col);
  if (!sample.length) return false;
  const unique = new Set(sample.map((value) => formatRankLabel(value).toLowerCase()));
  const numericRatio = sample.filter((value) => normalizeNumber(value) !== null).length / sample.length;
  return unique.size > 1 && unique.size <= 250 && numericRatio < 0.8;
};

const isWeakKpiDimension = (data, col) => {
  if (!col) return true;
  if (isFileLikeColumn(col) || isIdLikeColumn(col)) return true;
  const sample = columnSample(data, col, 1000);
  if (!sample.length) return true;
  const counts = {};
  sample.forEach((value) => {
    const key = formatRankLabel(value).toLowerCase();
    if (key === DASH.toLowerCase()) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  const values = Object.values(counts);
  const unique = values.length;
  const total = values.reduce((sum, value) => sum + value, 0);
  const topShare = total ? Math.max(...values) / total : 1;

  if (unique <= 1) return true;
  if (topShare >= (isQualitySignalColumn(col) ? 0.96 : 0.92)) return true;
  if (isWeakHeadlineColumn(col) && !isQualitySignalColumn(col) && unique <= 12) return true;
  if (familyForColumn(col) === "org" && unique <= 2 && topShare >= 0.82) return true;
  return false;
};

const scoreDimensionColumn = (data, col, metricCol) => {
  if (!isUsefulDimension(data, col, metricCol)) return -999;
  if (isWeakKpiDimension(data, col)) return -999;
  const sample = columnSample(data, col);
  const unique = new Set(sample.map((value) => formatRankLabel(value).toLowerCase()));
  let score = columnPreference(col);
  if (isNameLikeColumn(col)) score += 18;
  if (isContentLikeColumn(col)) score += 20;
  if (isOrgLikeColumn(col)) score += 8;
  if (isDateLikeColumn(data, col)) score -= 38;
  if (unique.size >= 2 && unique.size <= 80) score += 16;
  if (unique.size > 80) score -= 10;
  if (/(status|state)$/i.test(col) && !isQualitySignalColumn(col) && !isNameLikeColumn(col)) score -= 18;
  return score;
};

const pickColumn = (data, predicate, exclude = []) => Object.keys(data[0] || {})
  .filter((col) => !exclude.includes(col))
  .map((col) => ({ col, score: predicate(col) }))
  .filter((item) => item.score > -999)
  .sort((a, b) => b.score - a.score)[0]?.col || null;

const pickNameColumn = (data, exclude = []) => pickColumn(
  data,
  (col) => {
    if (!isUsefulDimension(data, col, exclude[0])) return -999;
    if (!isNameLikeColumn(col)) return -999;
    return 100 - new Set(columnSample(data, col).map((value) => formatRankLabel(value).toLowerCase())).size / 20;
  },
  exclude,
);

const pickDateColumn = (data, exclude = []) => pickColumn(
  data,
  (col) => (isDateLikeColumn(data, col) ? 80 : -999),
  exclude,
);

const pickOrgColumn = (data, exclude = []) => pickColumn(
  data,
  (col) => {
    if (!isUsefulDimension(data, col, exclude[0]) || !isOrgLikeColumn(col)) return -999;
    return scoreDimensionColumn(data, col, exclude[0]);
  },
  exclude,
);

const pickBreakdownColumn = (data, card) => {
  if (
    card.breakdownBy
    && Object.prototype.hasOwnProperty.call(data[0] || {}, card.breakdownBy)
    && !isIdLikeColumn(card.breakdownBy)
    && isUsefulDimension(data, card.breakdownBy, card.column)
    && !isWeakKpiDimension(data, card.breakdownBy)
  ) {
    return card.breakdownBy;
  }

  const cardText = `${card.label || ""} ${card.column || ""}`.toLowerCase();
  return pickColumn(
    data,
    (col) => {
      let score = scoreDimensionColumn(data, col, card.column);
      if (score <= -999) return score;
      const family = familyForColumn(col);
      if (/language|locale/i.test(cardText) && family === "language") score += 45;
      if (/platform|channel|source|social/i.test(cardText) && family === "platform") score += 45;
      if (/device|phone|browser/i.test(cardText) && family === "device") score += 45;
      if (/qa|quality|reject|recheck|remark|status/i.test(cardText) && family === "quality") score += 45;
      if (/category|job|task|product|menu/i.test(cardText) && family === "work") score += 35;
      if (/name|person|staff|worker|drummer|user/i.test(cardText) && (family === "identity" || family === "account")) score += 35;
      return score;
    },
    [card.column],
  );
};

const buildCardDisplayLabel = (card, dimensionLabel) => {
  const raw = cleanCardLabel(card.label || card.column || "Metric");
  if (!dimensionLabel || dimensionLabel === "Summary") return raw;
  const base = raw.replace(/\s+by\s+.+$/i, "").trim() || raw;
  return cleanCardLabel(`${base} by ${dimensionLabel}`);
};

const cardFamily = (card, data) => {
  const dimension = pickBreakdownColumn(data, card);
  return familyForColumn(dimension || card.breakdownBy || card.column || card.label);
};

const effectiveCardDimension = (card, data) => pickBreakdownColumn(data, card) || card.breakdownBy || card.column || card.label || "";

const cardScore = (card, data, originalIndex = 0) => {
  const dimension = effectiveCardDimension(card, data);
  const aggregation = effectiveAggregation(card);
  let score = 100 - originalIndex;
  score += columnPreference(dimension);
  if (aggregation === "count" && isCountLikeCard(card)) score += 12;
  if (dimension && isWeakKpiDimension(data, dimension)) score -= 40;
  if (isWeakMetricCard(data, card)) score -= 120;
  return score;
};

const bestColumnForFamily = (data, family, excludes = []) => Object.keys(data[0] || {})
  .filter((col) => !excludes.includes(col))
  .filter((col) => familyForColumn(col) === family)
  .filter((col) => !isIdLikeColumn(col) && isUsefulDimension(data, col, null) && !isWeakKpiDimension(data, col))
  .map((col) => ({ col, score: columnPreference(col) }))
  .sort((a, b) => b.score - a.score)[0]?.col || null;

const datasetUnitLabel = (data) => {
  const headers = Object.keys(data?.[0] || {}).join(" ").toLowerCase();
  if (/(image id|image description|image quality|image grouping|participant id)/i.test(headers)) return "Images";
  if (/(post|drummer|platform|social|qa remarks?)/i.test(headers)) return "Posts";
  if (/(task|ticket|job)/i.test(headers)) return "Tasks";
  return "Records";
};

const makeCountCardForColumn = (col, idPrefix = "auto", unitLabel = "Records") => ({
  id: `${idPrefix}_${col.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
  label: `${unitLabel} by ${cleanCardLabel(col)}`,
  column: col,
  aggregation: "count",
  formatHint: "number",
  breakdownBy: col,
  popupGraph: "distribution",
  plannerGenerated: false,
});

const metricClassForCard = (card = {}) => {
  const text = `${card.label || ""} ${card.column || ""}`.toLowerCase();
  if (card.aggregation === "distinct_count" || /\bunique|distinct\b/.test(text)) return "distinct";
  if (/\bavg|average|mean|per\b/.test(text)) return "average";
  if (/\bpercent|rate|ratio|share|completion\b/.test(text)) return "rate";
  if (/\btime|hour|hours|min|minute|minutes|duration|rework|annotation\b/.test(text)) return "duration";
  if (card.aggregation === "count" || isCountLikeCard(card)) return "count";
  return "sum";
};

const cardDimensionKey = (card, data) => String(effectiveCardDimension(card, data) || "").toLowerCase();
const cardSignatureKey = (card, data) => `${cardDimensionKey(card, data)}::${metricClassForCard(card)}`;

const runtimeCandidateScore = (data, col) => {
  if (!col || isIdLikeColumn(col) || isFileLikeColumn(col)) return -999;
  const sample = columnSample(data, col, 1000);
  if (!sample.length) return -999;
  const labels = sample.map((value) => formatRankLabel(value).toLowerCase()).filter((value) => value !== DASH.toLowerCase());
  const unique = new Set(labels);
  if (unique.size <= 1 || unique.size > 500) return -999;
  const numericRatio = sample.filter((value) => normalizeNumber(value) !== null).length / sample.length;
  if (numericRatio >= 0.98) return -999;
  const counts = {};
  labels.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
  const topShare = labels.length ? Math.max(...Object.values(counts)) / labels.length : 1;
  if (topShare >= 0.985) return -999;

  let score = columnPreference(col) + 40;
  const family = familyForColumn(col);
  if (["language", "platform", "work", "device", "quality", "identity", "reviewer", "org"].includes(family)) score += 25;
  if (/sub-?category|category|language|platform|device|quality|delivered by|checked by|remark|reject|recheck/i.test(col)) score += 20;
  if (isDateLikeColumn(data, col)) score -= 20;
  if (topShare > 0.9) score -= 15;
  return score;
};

const isWeakMetricCard = (data, card = {}) => {
  const aggregation = effectiveAggregation(card);
  const metricCol = String(card.column || "").trim();
  if (!metricCol) return true;

  if (aggregation === "count" || aggregation === "distinct_count") {
    return false;
  }

  if (isFileLikeColumn(metricCol) || isIdLikeColumn(metricCol)) return true;
  if (isSequenceLikeColumn(metricCol)) return true;

  const lower = metricCol.toLowerCase();
  if (/\b(grouping|identifier|number|index|sequence|serial|rank|position)\b/.test(lower)) return true;

  const sample = columnSample(data, metricCol, 1500);
  if (!sample.length) return true;

  const numericValues = sample
    .map((value) => normalizeNumber(value))
    .filter((value) => value !== null);

  if (!numericValues.length) return true;

  const uniqueCount = new Set(numericValues.map((value) => String(value))).size;
  const integerRatio = numericValues.filter((value) => Number.isInteger(value)).length / numericValues.length;
  const maxValue = Math.max(...numericValues);

  if (integerRatio >= 0.98 && uniqueCount <= 12 && maxValue <= 20) return true;
  return false;
};

const diversifyCards = (cards, data) => {
  if (!data?.length) return cards || [];
  const unitLabel = datasetUnitLabel(data);
  const targetCount = Math.min(4, Math.max(cards?.length || 0, 4));
  const ranked = (cards || [])
    .map((card, index) => ({
      card,
      index,
      family: cardFamily(card, data),
      dimension: effectiveCardDimension(card, data),
      score: cardScore(card, data, index),
    }))
    .filter((item) => item.score > 0 && !isWeakKpiDimension(data, item.dimension) && !isWeakMetricCard(data, item.card))
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const seenDimensions = new Set();
  const pushGeneratedCard = (col, idPrefix = "auto_fill_relaxed") => {
    const dimensionKey = String(col || "").toLowerCase();
    if (!dimensionKey || seenDimensions.has(dimensionKey) || isWeakKpiDimension(data, col)) return false;
    selected.push(makeCountCardForColumn(col, idPrefix, unitLabel));
    seenDimensions.add(dimensionKey);
    return true;
  };
  const addCard = (card) => {
    const family = cardFamily(card, data);
    const dimension = effectiveCardDimension(card, data);
    const dimensionKey = String(dimension || "").toLowerCase();
    if (!dimensionKey || seenDimensions.has(dimensionKey) || isWeakKpiDimension(data, dimension)) return false;
    const hasIdentity = selected.some((existing) => cardFamily(existing, data) === "identity");
    const hasAccount = selected.some((existing) => cardFamily(existing, data) === "account");
    if (family === "account" && hasIdentity) return false;
    if (family === "identity" && hasAccount) {
      const accountIndex = selected.findIndex((existing) => cardFamily(existing, data) === "account");
      if (accountIndex >= 0) {
        const [removed] = selected.splice(accountIndex, 1);
        seenDimensions.delete(String(effectiveCardDimension(removed, data) || "").toLowerCase());
      }
    }
    seenDimensions.add(dimensionKey);
    selected.push(card);
    return true;
  };

  ranked.forEach((item) => {
    if (selected.length >= 4) return;
    addCard(item.card);
  });

  const usedDimensions = () => selected.map((card) => effectiveCardDimension(card, data));
  const preferredFamilies = ["reviewer", "quality", "language", "platform", "work", "device", "identity", "org"];
  preferredFamilies.forEach((family) => {
    if (selected.length >= 4) return;
    if (selected.some((card) => cardFamily(card, data) === family) && family !== "reviewer" && family !== "quality") return;
    const col = bestColumnForFamily(data, family, usedDimensions());
    if (col) addCard(makeCountCardForColumn(col, `auto_${family}`, unitLabel));
  });

  if (selected.length < 4) {
    Object.keys(data[0] || {})
      .map((col) => ({ col, score: scoreDimensionColumn(data, col, null) }))
      .filter((item) => item.score > -999)
      .sort((a, b) => b.score - a.score)
      .forEach((item) => {
        if (selected.length >= 4) return;
        pushGeneratedCard(item.col, "auto_fill");
      });
  }

  if (selected.length < targetCount) {
    Object.keys(data[0] || {})
      .map((col) => {
        const sample = columnSample(data, col, 1000);
        const unique = new Set(sample.map((value) => formatRankLabel(value).toLowerCase()).filter((value) => value !== DASH.toLowerCase()));
        const numericRatio = sample.length ? sample.filter((value) => normalizeNumber(value) !== null).length / sample.length : 1;
        const counts = {};
        sample.forEach((value) => {
          const key = formatRankLabel(value).toLowerCase();
          if (key === DASH.toLowerCase()) return;
          counts[key] = (counts[key] || 0) + 1;
        });
        const values = Object.values(counts);
        const topShare = values.length && sample.length ? Math.max(...values) / sample.length : 1;
        const useful = sample.length
          && unique.size > 1
          && unique.size <= 500
          && numericRatio < 0.98
          && topShare < 0.985
          && !isIdLikeColumn(col)
          && !isFileLikeColumn(col);
        return { col, score: useful ? columnPreference(col) + Math.min(40, unique.size / 2) - (topShare > 0.9 ? 18 : 0) : -999 };
      })
      .filter((item) => item.score > -999)
      .sort((a, b) => b.score - a.score)
      .forEach((item) => {
        if (selected.length >= targetCount) return;
        pushGeneratedCard(item.col, "auto_relaxed");
      });
  }

  return selected.length ? selected : cards;
};

const columnRole = (data, col) => {
  if (!col) return "summary";
  if (isNameLikeColumn(col)) return "person";
  if (isDateLikeColumn(data, col)) return "date";
  if (isOrgLikeColumn(col)) return "group";
  return "group";
};

const dimensionStatsForRows = (rows, col) => {
  if (!col) return { unique: 0, topShare: 1 };
  const counts = {};
  let total = 0;
  rows.forEach((row) => {
    const label = formatRankLabel(row[col]);
    if (label === DASH) return;
    const key = label.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    total += 1;
  });
  const values = Object.values(counts);
  const top = values.length ? Math.max(...values) : 0;
  return {
    unique: values.length,
    topShare: total ? top / total : 1,
  };
};

const hasUsefulVariety = (rows, col) => {
  const stats = dimensionStatsForRows(rows, col);
  return stats.unique > 1 && stats.unique <= 80 && stats.topShare < 0.96;
};

const scoreSecondaryColumn = (data, rows, col, excludes = []) => {
  if (!col || excludes.includes(col) || isIdLikeColumn(col)) return -999;
  if (!hasUsefulVariety(rows, col)) return -999;
  const stats = dimensionStatsForRows(rows, col);
  let score = 0;
  if (isContentLikeColumn(col)) score += 90;
  if (isNameLikeColumn(col)) score += 80;
  if (isOrgLikeColumn(col)) score += 55;
  if (isDateLikeColumn(data, col)) score += 38;
  if (stats.unique >= 3 && stats.unique <= 20) score += 22;
  if (stats.unique > 20) score -= 12;
  if (stats.topShare > 0.85) score -= 20;
  return score;
};

const pickSecondaryColumn = (data, rows, preferred = [], excludes = []) => {
  const columns = Object.keys(data[0] || {});
  const preferredHit = preferred.find((col) => scoreSecondaryColumn(data, rows, col, excludes) > -999);
  if (preferredHit) return preferredHit;
  return columns
    .map((col) => ({ col, score: scoreSecondaryColumn(data, rows, col, excludes) }))
    .filter((item) => item.score > -999)
    .sort((a, b) => b.score - a.score)[0]?.col || null;
};

function RankBar({ pct, accent }) {
  return (
    <div style={{ height: 3, borderRadius: 999, background: KPI.track, overflow: "hidden", marginTop: 3 }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, pct))}%`, background: accent, borderRadius: 999 }} />
    </div>
  );
}

function topByCount(rows, col) {
  if (!col) return null;
  const counts = {};
  const canonical = {};
  rows.forEach((row) => {
    const label = formatRankLabel(row[col]);
    if (label === DASH) return;
    const key = label.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    if (!canonical[key]) canonical[key] = label;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { label: canonical[top[0]], value: top[1] } : null;
}

function uniqueCount(rows, col) {
  if (!col) return 0;
  return new Set(rows.map((row) => formatRankLabel(row[col]).toLowerCase()).filter((value) => value && value !== DASH.toLowerCase())).size;
}

function stat(label, value) {
  return { label, value: value === null || value === undefined || value === "" ? DASH : value };
}

function relatedFamilyStats({ item, data, dimensionCol, family }) {
  const cols = Object.keys(data[0] || {})
    .filter((col) => col !== dimensionCol && familyForColumn(col) === family && !isIdLikeColumn(col))
    .map((col) => {
      const top = topByCount(item.rows, col);
      return top ? stat(titleCase(col), top.label) : null;
    })
    .filter(Boolean);
  return cols.slice(0, 2);
}

function buildPopoverDetails({ item, card, data, hint, role, dimensionCol, totalValue }) {
  const aggregation = effectiveAggregation(card);
  const isCountMetric = aggregation === "count" || aggregation === "distinct_count";
  const metricValues = item.rows.map((row) => normalizeNumber(row[card.column])).filter((value) => value !== null);
  const metricTotal = isCountMetric ? Number(item.value) || item.rows.length : metricValues.reduce((sum, value) => sum + value, 0);
  const recordCount = item.rows.length;
  const average = isCountMetric
    ? (recordCount ? metricTotal / recordCount : 0)
    : (metricValues.length ? metricTotal / metricValues.length : 0);
  const graphHint = isCountMetric ? "number" : hint;
  const dateCol = pickDateColumn(data, [card.column, dimensionCol]);
  const nameCol = pickNameColumn(data, [card.column, dimensionCol]);
  const orgCol = pickOrgColumn(data, [card.column, dimensionCol]);
  const topDate = topByCount(item.rows, dateCol);
  const topPerson = topByCount(item.rows, nameCol);
  const topOrg = topByCount(item.rows, orgCol);
  const contribution = totalValue > 0 ? `${((Number(item.value) || 0) / totalValue * 100).toFixed(1)}%` : DASH;
  const contentCol = pickSecondaryColumn(
    data,
    item.rows,
    [nameCol, orgCol, dateCol],
    [card.column, dimensionCol],
  );
  const contentLabel = contentCol ? titleCase(contentCol) : "Breakdown";
  const relatedIdentityStats = relatedFamilyStats({
    item,
    data,
    dimensionCol,
    family: familyForColumn(dimensionCol || ""),
  });

  if (role === "person") {
    const personSecondary = pickSecondaryColumn(
      data,
      item.rows,
      [contentCol, orgCol, dateCol],
      [card.column, dimensionCol],
    );
    return {
      title: "Headcount profile",
      stats: [
        stat("Total value", item.display),
        stat("Records", recordCount.toLocaleString()),
        stat("Avg / record", fmt(average, graphHint)),
        stat("Active days", uniqueCount(item.rows, dateCol).toLocaleString()),
        stat("Top day", topDate?.label),
        stat(personSecondary ? titleCase(personSecondary) : topOrg ? titleCase(orgCol) : "Top group", topByCount(item.rows, personSecondary)?.label || topOrg?.label),
        ...relatedIdentityStats,
        stat("Share", contribution),
      ].filter((entry) => entry.value !== DASH),
      graphTitle: personSecondary ? `By ${titleCase(personSecondary)}` : topDate ? "Activity by day" : "Record mix",
      graphRows: buildSecondaryRows(item.rows, personSecondary || dateCol || nameCol, card.column, graphHint, aggregation),
    };
  }

  if (role === "date") {
    const dateSecondary = pickSecondaryColumn(
      data,
      item.rows,
      [nameCol, contentCol, orgCol],
      [card.column, dimensionCol],
    );
    return {
      title: "Day summary",
      stats: [
        stat("Total value", item.display),
        stat("People", uniqueCount(item.rows, nameCol).toLocaleString()),
        stat("Records", recordCount.toLocaleString()),
        stat("Top person", topPerson?.label),
        stat(dateSecondary ? titleCase(dateSecondary) : topOrg ? titleCase(orgCol) : "Top group", topByCount(item.rows, dateSecondary)?.label || topOrg?.label),
        ...relatedIdentityStats,
        stat("Share", contribution),
      ].filter((entry) => entry.value !== DASH),
      graphTitle: dateSecondary ? `By ${titleCase(dateSecondary)}` : topPerson ? `People on ${item.label}` : "Day mix",
      graphRows: buildSecondaryRows(item.rows, dateSecondary || nameCol || orgCol, card.column, graphHint, aggregation),
    };
  }

  if (role === "group") {
    const groupSecondary = pickSecondaryColumn(
      data,
      item.rows,
      [contentCol, nameCol, dateCol],
      [card.column, dimensionCol],
    );
    return {
      title: `${titleCase(dimensionCol)} summary`,
      stats: [
        stat("Total value", item.display),
        stat("People", uniqueCount(item.rows, nameCol).toLocaleString()),
        stat("Records", recordCount.toLocaleString()),
        stat("Avg / person", uniqueCount(item.rows, nameCol) ? fmt(metricTotal / uniqueCount(item.rows, nameCol), graphHint) : DASH),
        stat("Top contributor", topPerson?.label),
        ...relatedIdentityStats,
        stat("Share", contribution),
      ].filter((entry) => entry.value !== DASH),
      graphTitle: groupSecondary ? `By ${titleCase(groupSecondary)}` : topPerson ? `Top people in ${item.label}` : contentLabel,
      graphRows: buildSecondaryRows(item.rows, groupSecondary || nameCol || dateCol, card.column, graphHint, aggregation),
    };
  }

  return {
    title: "Summary detail",
    stats: [
      stat("Value", item.display),
      stat("Records", recordCount.toLocaleString()),
      stat("Avg / record", fmt(average, hint)),
      stat("Share", contribution),
    ],
    graphTitle: "Metric breakdown",
    graphRows: [],
  };
}

function buildSecondaryRows(rows, dimensionCol, metricCol, hint, aggregation = "sum") {
  if (!dimensionCol) return [];
  const isCountMetric = aggregation === "count" || aggregation === "distinct_count";
  const groups = {};
  const canonical = {};
  rows.forEach((row) => {
    const label = formatRankLabel(row[dimensionCol]);
    if (label === DASH) return;
    const value = isCountMetric ? 1 : normalizeNumber(row[metricCol]);
    if (value === null) return;
    const key = label.toLowerCase();
    groups[key] = (groups[key] || 0) + value;
    if (!canonical[key]) canonical[key] = label;
  });
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value]) => ({ label: canonical[key], value, display: fmt(value, hint) }));
}

function DetailStatGrid({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {stats.slice(0, 6).map((entry) => (
        <div key={`${entry.label}-${entry.value}`}>
          <div style={{ fontSize: 9, fontWeight: 800, color: KPI.mutedText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {entry.label}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: UI.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniContentGraph({ rows, title, accent }) {
  if (!rows?.length) return null;
  const maxValue = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  return (
    <div style={{
      marginTop: 12,
      padding: "10px 11px",
      borderRadius: 12,
      background: KPI.panelBg,
      border: `1px solid ${UI.border}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: KPI.mutedText, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map((row, index) => {
          const width = Math.min(100, Math.max(3, (Number(row.value) || 0) / maxValue * 100));
          return (
            <div key={`${row.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(52px, 0.7fr) 1fr 54px", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: index === 0 ? accent : KPI.mutedText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.label}
              </div>
              <div style={{ height: 7, borderRadius: 999, background: KPI.miniTrack, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${width}%`, borderRadius: 999, background: index === 0 ? accent : KPI.miniFill }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: UI.text, textAlign: "right" }}>{row.display}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildMetricSummary(data, card, hint) {
  const numericValues = data.map((row) => normalizeNumber(row[card.column])).filter((value) => value !== null);
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  const average = numericValues.length ? total / numericValues.length : 0;
  const highest = numericValues.length ? Math.max(...numericValues) : 0;
  const lowest = numericValues.length ? Math.min(...numericValues) : 0;
  const rankings = [
    { label: "Average per record", value: average, display: fmt(average, hint), rows: data },
    { label: "Highest record", value: highest, display: fmt(highest, hint), rows: data },
    { label: "Lowest record", value: lowest, display: fmt(lowest, hint), rows: data },
    { label: "Records with value", value: numericValues.length, display: numericValues.length.toLocaleString(), rows: data },
  ];
  return {
    rankings,
    topValue: highest || average || numericValues.length || 1,
    summaryValue: total,
    summaryHint: hint,
    dimensionLabel: "Summary",
    dimensionCol: null,
    role: "summary",
    totalValue: total,
  };
}

function buildRankings(data, card, hint) {
  const aggregation = effectiveAggregation(card);
  const dimensionCol = aggregation === "distinct_count" ? card.column : pickBreakdownColumn(data, card);
  const role = columnRole(data, dimensionCol);

  if (!dimensionCol) return buildMetricSummary(data, card, hint);

  const groups = {};
  const canonical = {};
  data.forEach((row) => {
    const labelValue = formatRankLabel(row[dimensionCol]);
    const key = labelValue.toLowerCase();
    if (key === DASH.toLowerCase()) return;

    let contribution = 0;
    if (aggregation === "count" || aggregation === "distinct_count") {
      contribution = isBlank(row[card.column]) ? 0 : 1;
    } else {
      contribution = normalizeNumber(row[card.column]) || 0;
    }

    if (!groups[key]) groups[key] = { value: 0, rows: [] };
    groups[key].value += contribution;
    groups[key].rows.push(row);
    if (!canonical[key]) canonical[key] = labelValue;
  });

  const rankings = Object.entries(groups)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 8)
    .map(([key, group]) => ({
      label: canonical[key],
      value: group.value,
      display: fmt(group.value, aggregation === "count" || aggregation === "distinct_count" ? "number" : hint),
      rows: group.rows,
    }));

  if (!rankings.length) return buildMetricSummary(data, card, hint);

  const totalValue = rankings.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const summaryValue = aggregation === "distinct_count"
    ? new Set(data.map((row) => formatRankLabel(row[card.column]).toLowerCase()).filter((value) => value !== DASH.toLowerCase())).size
    : data.reduce((sum, row) => {
      if (aggregation === "count") return sum + (isBlank(row[card.column]) ? 0 : 1);
      return sum + (normalizeNumber(row[card.column]) || 0);
    }, 0);

  return {
    rankings,
    topValue: rankings[0]?.value || 1,
    summaryValue,
    summaryHint: aggregation === "count" || aggregation === "distinct_count" ? "number" : hint,
    dimensionLabel: cleanCardLabel(dimensionCol),
    dimensionCol,
    role,
    totalValue: summaryValue || totalValue,
  };
}

function SummaryCard({ card, data, accent, isPreview = false }) {
  const hint = card.formatHint || "number";

  const {
    rankings,
    topValue,
    summaryValue,
    summaryHint,
    dimensionLabel,
    dimensionCol,
    role,
    totalValue,
  } = useMemo(() => buildRankings(data, card, hint), [data, card, hint]);
  const label = buildCardDisplayLabel(card, dimensionLabel);

  return (
    <div
      style={{
        background: KPI.cardBg,
        borderRadius: 16,
        padding: "20px 22px",
        borderLeft: `4px solid ${accent}`,
        boxShadow: "var(--color-shadow-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        cursor: "default",
        fontFamily: "'Manrope', sans-serif",
        border: `1px solid ${UI.border}`,
        overflow: "visible",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: KPI.mutedText, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: KPI.mutedText, fontWeight: 600 }}>
            {isPreview ? "Preview · " : ""}
            {dimensionLabel === "Summary" ? "Summary details" : `Top ${rankings.length} by ${dimensionLabel}`}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.03em" }}>
          {fmt(summaryValue, summaryHint)}
        </div>
      </div>

      <div style={{ height: 1, background: KPI.divider, marginBottom: 12 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rankings.map((item, index) => {
          const pct = topValue > 0 ? (item.value / topValue) * 100 : 0;
          const isTop = index < 3;
          const details = buildPopoverDetails({ item, card, data, hint, role, dimensionCol, totalValue });
          return (
            <div
              key={`${item.label}-${index}`}
              className="summary-rank-row"
              tabIndex={0}
              style={{ position: "relative", padding: "6px 8px", margin: "0 -8px", borderRadius: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: isTop ? accent : KPI.badgeBg,
                  border: isTop ? "none" : `1px solid ${KPI.trackStrong}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isTop ? 11 : 10,
                  fontWeight: 800,
                  color: isTop ? "#fff" : KPI.mutedText,
                  flexShrink: 0,
                }}>
                  {isTop ? TOP_BADGES[index] : index + 1}
                </div>
                <div style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: index === 0 ? 700 : 500,
                  color: index === 0 ? UI.text : KPI.mutedText,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: index === 0 ? accent : UI.text, flexShrink: 0 }}>
                  {item.display}
                </div>
              </div>
              <div style={{ paddingLeft: 30 }}>
                <RankBar pct={pct} accent={index === 0 ? accent : KPI.trackStrong} />
              </div>
              <div
                className="summary-rank-popover"
                style={{
                  position: "absolute",
                  left: 36,
                  right: 8,
                  ...(index < 3
                    ? { top: "calc(100% + 8px)" }
                    : { bottom: "calc(100% + 8px)" }),
                  zIndex: 1000,
                  padding: "12px 13px",
                  borderRadius: 14,
                  background: KPI.popoverBg,
                  border: `1px solid ${UI.border}`,
                  boxShadow: KPI.shadow,
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "opacity 0.14s ease",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                  {details.title} - Rank #{index + 1}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: UI.text, lineHeight: 1.25, marginBottom: 9, wordBreak: "break-word" }}>
                  {item.label}
                </div>
                <DetailStatGrid stats={details.stats} />
                <MiniContentGraph rows={details.graphRows} title={details.graphTitle} accent={accent} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function resolveSummaryCards(data, cards, targetCount = 4) {
  if (!data?.length) return cards || [];

  const resolvedTargetCount = Math.min(targetCount, Math.max(cards?.length || 0, targetCount));
  const diversified = diversifyCards(cards, data);
  const unitLabel = datasetUnitLabel(data);
  const runtimeCandidates = Object.keys(data[0] || {})
    .map((col) => ({ col, score: runtimeCandidateScore(data, col) }))
    .filter((item) => item.score > -999)
    .sort((a, b) => b.score - a.score)
    .map((item) => makeCountCardForColumn(item.col, "runtime_fill", unitLabel));

  const pool = [...diversified, ...(cards || []), ...runtimeCandidates]
    .filter(Boolean)
    .filter((card) => !isWeakMetricCard(data, card));

  const selected = [];
  const seenDimensions = new Set();
  const seenSignatures = new Set();

  const resolvedIdentityForCard = (card) => {
    const rankingData = buildRankings(data, card, card.formatHint || "number");
    const resolvedDimension = String(rankingData.dimensionCol || rankingData.dimensionLabel || effectiveCardDimension(card, data) || "").toLowerCase();
    const leadingLabels = rankingData.rankings
      .slice(0, 4)
      .map((item) => String(item.label || "").toLowerCase())
      .join("|");
    return {
      dimensionKey: resolvedDimension,
      signatureKey: `${resolvedDimension}::${metricClassForCard(card)}::${leadingLabels}`,
    };
  };

  const tryAdd = (card, { allowSameDimension = false } = {}) => {
    const { dimensionKey, signatureKey } = resolvedIdentityForCard(card);
    if (!dimensionKey || !signatureKey) return false;
    if (seenSignatures.has(signatureKey)) return false;
    if (!allowSameDimension && seenDimensions.has(dimensionKey)) return false;
    seenDimensions.add(dimensionKey);
    seenSignatures.add(signatureKey);
    selected.push(card);
    return true;
  };

  pool.forEach((card) => {
    if (selected.length >= resolvedTargetCount) return;
    tryAdd(card, { allowSameDimension: false });
  });

  if (selected.length < resolvedTargetCount) {
    pool.forEach((card) => {
      if (selected.length >= resolvedTargetCount) return;
      tryAdd(card, { allowSameDimension: true });
    });
  }

  return selected.slice(0, resolvedTargetCount);
}

export default function SummaryCards({ data, cards, isPreview = false }) {
  const displayCards = useMemo(() => resolveSummaryCards(data, cards), [cards, data]);
  if (!displayCards || displayCards.length === 0) return null;
  return (
    <>
      <style>{`
        :root {
          --kpi-card-bg: #ffffff;
          --kpi-popover-bg: #ffffff;
          --kpi-muted-text: #53685e;
          --kpi-divider: rgba(28, 43, 35, 0.18);
          --kpi-track: rgba(28, 43, 35, 0.12);
          --kpi-track-strong: rgba(28, 43, 35, 0.32);
          --kpi-badge-bg: rgba(28, 43, 35, 0.10);
          --kpi-panel-bg: rgba(4, 98, 65, 0.045);
          --kpi-mini-track: rgba(28, 43, 35, 0.12);
          --kpi-mini-fill: rgba(28, 43, 35, 0.42);
          --kpi-row-hover-bg: rgba(4, 98, 65, 0.07);
          --kpi-popover-shadow: 0 22px 48px rgba(28, 43, 35, 0.18);
        }
        :root[data-theme="dark"] {
          --kpi-card-bg: var(--color-surface-elevated);
          --kpi-popover-bg: var(--color-surface-elevated);
          --kpi-muted-text: var(--color-text-light);
          --kpi-divider: var(--color-border-strong);
          --kpi-track: var(--color-border);
          --kpi-track-strong: var(--color-border-strong);
          --kpi-badge-bg: var(--color-border);
          --kpi-panel-bg: rgba(255, 255, 255, 0.045);
          --kpi-mini-track: rgba(255, 255, 255, 0.08);
          --kpi-mini-fill: rgba(255, 255, 255, 0.45);
          --kpi-row-hover-bg: rgba(255, 255, 255, 0.06);
          --kpi-popover-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
        }
        .summary-rank-row:hover,
        .summary-rank-row:focus {
          background: var(--kpi-row-hover-bg);
          outline: none;
          z-index: 1001;
        }
        .summary-rank-row:hover .summary-rank-popover,
        .summary-rank-row:focus .summary-rank-popover,
        .summary-rank-row:focus-within .summary-rank-popover {
          opacity: 1 !important;
        }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {displayCards.map((card, index) => (
          <SummaryCard key={card.id || `${card.label}-${index}`} card={card} data={data} accent={ACCENTS[index % ACCENTS.length]} isPreview={isPreview} />
        ))}
      </div>
    </>
  );
}
