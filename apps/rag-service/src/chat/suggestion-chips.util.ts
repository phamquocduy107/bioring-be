export interface SuggestionChip {
  /** Text hiển thị trên nút */
  label: string;
  /** Text gửi lại làm câu hỏi follow-up khi user bấm */
  question: string;
  /** Loại action để FE analytics / styling (optional) */
  action:
    | 'expand_budget'
    | 'clear_stone'
    | 'clear_style'
    | 'relax_all';
}

/**
 * Sinh chip gợi ý khi RING_RECOMMENDATION không có sản phẩm khớp.
 * Chỉ đề xuất nới những filter đang thực sự active.
 */
export function buildEmptyProductSuggestionChips(
  productFilters: Record<string, unknown>,
): SuggestionChip[] {
  const chips: SuggestionChip[] = [];
  const budgetMax = toNumber(productFilters.budgetMax);
  const hasStone = !!(productFilters.stoneName || productFilters.stoneColor);
  const hasStyle = !!toString(productFilters.style);

  if (budgetMax != null) {
    // Chỉ 1 chip nới ngân sách: bước kế tiếp hợp lý
    if (budgetMax < 10_000_000) {
      chips.push({
        label: 'Ngân sách dưới 10 triệu',
        question: 'Ngân sách dưới 10 triệu',
        action: 'expand_budget',
      });
    } else if (budgetMax < 20_000_000) {
      chips.push({
        label: 'Ngân sách dưới 20 triệu',
        question: 'Ngân sách dưới 20 triệu',
        action: 'expand_budget',
      });
    } else if (budgetMax < 50_000_000) {
      chips.push({
        label: 'Ngân sách dưới 50 triệu',
        question: 'Ngân sách dưới 50 triệu',
        action: 'expand_budget',
      });
    }
  } else {
    chips.push({
      label: 'Ngân sách dưới 10 triệu',
      question: 'Ngân sách dưới 10 triệu',
      action: 'expand_budget',
    });
  }

  if (hasStone) {
    chips.push({
      label: 'Bỏ lọc đá',
      question: 'Bỏ lọc đá',
      action: 'clear_stone',
    });
  }

  if (hasStyle) {
    chips.push({
      label: 'Bỏ lọc phong cách',
      question: 'Bỏ lọc phong cách',
      action: 'clear_style',
    });
  }

  // Chỉ hiện "nới hết" khi đang giữ ≥2 filter siết (budget + style/stone hoặc style+stone)
  const tightCount =
    (budgetMax != null ? 1 : 0) + (hasStyle ? 1 : 0) + (hasStone ? 1 : 0);
  if (tightCount >= 2) {
    chips.push({
      label: 'Nới hết lọc',
      question: 'Nới hết lọc',
      action: 'relax_all',
    });
  }

  // Ưu tiên: budget → clear filters → relax_all; tối đa 3 nút
  const priority: SuggestionChip['action'][] = [
    'expand_budget',
    'clear_stone',
    'clear_style',
    'relax_all',
  ];
  const unique: SuggestionChip[] = [];
  for (const action of priority) {
    for (const chip of chips) {
      if (chip.action === action && !unique.some((u) => u.label === chip.label)) {
        unique.push(chip);
      }
    }
  }
  return unique.slice(0, 3);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t || null;
}
