export type SampleToken = {
  person: string;
  status: "waiting" | "serving" | "served" | "cancelled";
  createdMinAgo: number;
  calledMinAgo?: number;
  completedMinAgo?: number;
  cancelledMinAgo?: number;
  position: number;
  number: number;
};

const FRONT = [
  "Meera Iyer",
  "Rahul Deshmukh",
  "Ananya Rao",
  "Joseph Mathew",
  "Kavya Shenoy",
  "Farhan Qureshi",
  "Sneha Patil",
  "Imran Sheikh",
  "Divya Nair",
  "Arjun Menon",
  "Lakshmi Bhat",
  "Nikhil Jain",
  "Pooja Kulkarni",
  "Hari Prasad",
  "Aisha Khan",
  "Vikram Setty",
];

const PHARMACY = [
  "Neha Kulkarni",
  "Sanjay Rao",
  "Fatima Begum",
  "Rakesh Gowda",
  "Priya Menon",
  "Aditya Shah",
  "Leela Krishnan",
  "Mohammed Irfan",
  "Shreya Pai",
  "Thomas Kurian",
  "Anjali Desai",
  "Kiran Hegde",
  "Rohit Varma",
  "Sara D'Souza",
  "Gopal Reddy",
  "Nandini Joshi",
];

function waitingAt(token: SampleToken, minutesAgo: number) {
  if (token.createdMinAgo < minutesAgo) return false;
  if (token.status === "waiting") return true;
  if (token.status === "cancelled") return (token.cancelledMinAgo ?? -1) < minutesAgo;
  return (token.calledMinAgo ?? -1) < minutesAgo;
}

export function buildShift(input: {
  names: string[];
  startMinAgo: number;
  gap: number;
  wait: number;
  service: number;
  waitingCount: number;
}): SampleToken[] {
  const tokens: SampleToken[] = [];
  const reserved = input.waitingCount + 2;
  let index = 0;
  let cursor = input.startMinAgo;
  const floor = input.wait + input.service + 5;
  while (index < input.names.length - reserved && cursor > floor) {
    const created = cursor;
    const called = created - input.wait;
    const completed = called - input.service;
    tokens.push({
      person: input.names[index],
      status: "served",
      createdMinAgo: created,
      calledMinAgo: called,
      completedMinAgo: completed,
      position: 0,
      number: 0,
    });
    index += 1;
    cursor -= input.gap;
  }
  tokens.push({
    person: input.names[index],
    status: "cancelled",
    createdMinAgo: 52,
    cancelledMinAgo: 44,
    position: 0,
    number: 0,
  });
  index += 1;
  const calledMinAgo = 4;
  tokens.push({
    person: input.names[index],
    status: "serving",
    createdMinAgo: calledMinAgo + input.wait,
    calledMinAgo,
    position: 0,
    number: 0,
  });
  index += 1;
  const waiting: SampleToken[] = [];
  for (let w = 0; w < input.waitingCount; w += 1) {
    waiting.push({
      person: input.names[index],
      status: "waiting",
      createdMinAgo: Math.max(1, calledMinAgo - 1 - w),
      position: 0,
      number: 0,
    });
    index += 1;
  }
  waiting.sort((a, b) => b.createdMinAgo - a.createdMinAgo);
  waiting.forEach((token, position) => {
    token.position = position + 1;
  });
  tokens.push(...waiting);
  const numbered = [...tokens].sort((a, b) => b.createdMinAgo - a.createdMinAgo);
  numbered.forEach((token, order) => {
    token.number = order + 1;
  });
  return tokens;
}

export function snapshotsFor(tokens: SampleToken[], fromMinAgo: number, step: number) {
  const points: { minAgo: number; waiting: number }[] = [];
  for (let minutesAgo = fromMinAgo; minutesAgo >= 0; minutesAgo -= step) {
    points.push({
      minAgo: minutesAgo,
      waiting: tokens.filter((token) => waitingAt(token, minutesAgo)).length,
    });
  }
  if (points[points.length - 1]?.minAgo !== 0) {
    points.push({
      minAgo: 0,
      waiting: tokens.filter((token) => token.status === "waiting").length,
    });
  }
  return points;
}

export function sampleQueues() {
  const front = buildShift({
    names: FRONT,
    startMinAgo: 340,
    gap: 28,
    wait: 6,
    service: 8,
    waitingCount: 3,
  });
  const pharmacy = buildShift({
    names: PHARMACY,
    startMinAgo: 320,
    gap: 36,
    wait: 14,
    service: 7,
    waitingCount: 4,
  });
  return [
    { name: "Front desk", baseCode: "A", tokens: front, fromMinAgo: 340 },
    { name: "Pharmacy", baseCode: "P", tokens: pharmacy, fromMinAgo: 320 },
  ];
}

export function nextCode(taken: Set<string>, base: string) {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "Q";
  if (!taken.has(clean)) return clean;
  for (let n = 2; n < 100; n += 1) {
    const suffix = String(n);
    const code = (clean.slice(0, Math.max(1, 4 - suffix.length)) + suffix).slice(0, 4);
    if (!taken.has(code)) return code;
  }
  return `Q${taken.size % 100}`.slice(0, 4);
}
