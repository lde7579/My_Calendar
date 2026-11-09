// 화면 표시용 순수 함수 (외부 호출 없음)

/** 소수점 한 자리까지 내림하고 ".0"은 떼어낸다 (반올림하면 9999.95만 → "10000만"이 될 수 있다) */
function toUnit(n: number, unit: number): string {
  return String(Math.floor(n / (unit / 10)) / 10);
}

/** 1만 미만은 "9,999", 1만 이상은 "12.3만", 1억 이상은 "1.2억" */
export function formatCount(n: number): string {
  if (n >= 100_000_000) return `${toUnit(n, 100_000_000)}억`;
  if (n >= 10_000) return `${toUnit(n, 10_000)}만`;
  return n.toLocaleString("ko-KR");
}

// YouTube 기본 카테고리 ID → 한국어 이름 (API 호출 없이 상수로 처리)
const CATEGORY_NAMES: Record<string, string> = {
  "1": "영화/애니메이션",
  "2": "자동차",
  "10": "음악",
  "15": "동물",
  "17": "스포츠",
  "19": "여행/이벤트",
  "20": "게임",
  "22": "인물/블로그",
  "23": "코미디",
  "24": "엔터테인먼트",
  "25": "뉴스/정치",
  "26": "노하우/스타일",
  "27": "교육",
  "28": "과학기술",
};

export function categoryName(id: string): string {
  return CATEGORY_NAMES[id] ?? `카테고리 ${id}`;
}
