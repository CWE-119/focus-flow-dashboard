export interface ShowcaseTask {
  title: string;
  category: string;
  color: string;
  priority: "High" | "Medium" | "Low";
  completed?: boolean;
}

export const showcaseTasks: ShowcaseTask[] = [
  { title: "Polish launch story", category: "Launch", color: "#d96aa3", priority: "High" },
  { title: "Review onboarding flow", category: "Product", color: "#5ca8e0", priority: "High" },
  { title: "Write release notes", category: "Writing", color: "#9b7ed9", priority: "Medium" },
  { title: "Prepare demo workspace", category: "Launch", color: "#d96aa3", priority: "Medium" },
  { title: "Archive research clips", category: "Research", color: "#e09746", priority: "Low", completed: true },
];

export const showcaseMetrics = [
  { label: "Today", value: "4h 32m", detail: "deep focus" },
  { label: "Sessions", value: "18", detail: "this week" },
  { label: "Streak", value: "12", detail: "days" },
  { label: "Average", value: "51m", detail: "per session" },
];

export const activityLevels = Array.from({ length: 112 }, (_, index) => {
  const signal = (index * 7 + Math.floor(index / 4) * 3) % 17;
  if (index > 102) return 0;
  if (signal < 3) return 0;
  if (signal < 7) return 1;
  if (signal < 11) return 2;
  if (signal < 15) return 3;
  return 4;
});

export const showcaseFolders = [
  { id: "strategy", name: "Strategy", count: 6, color: "#d96aa3" },
  { id: "product", name: "Product", count: 8, color: "#5ca8e0" },
  { id: "research", name: "Research", count: 5, color: "#e09746" },
  { id: "journal", name: "Journal", count: 12, color: "#9b7ed9" },
];

export const showcaseNotes = [
  {
    id: "launch-playbook",
    title: "Launch Playbook",
    folderId: "strategy",
    excerpt: "A calm, repeatable path from final polish to launch day.",
    updated: "2 min ago",
    pinned: true,
    content: "Connect the [[North Star]] to [[Campaign Systems]], protect [[Deep Work]], and close each day with a [[Daily Review]]. [[Press Kit]]",
  },
  {
    id: "north-star",
    title: "North Star",
    folderId: "strategy",
    excerpt: "Make focused work feel simple, visible, and rewarding.",
    updated: "18 min ago",
    pinned: true,
    content: "The [[Roadmap]] follows our [[Customer Signals]]. Every release should strengthen the [[Launch Playbook]] and the [[Focus Ritual]].",
  },
  {
    id: "campaign-systems",
    title: "Campaign Systems",
    folderId: "strategy",
    excerpt: "Channels, story beats, assets, and a sustainable cadence.",
    updated: "Yesterday",
    content: "Build from the [[Launch Playbook]], source proof from [[Customer Signals]], and publish the [[Release Notes]].",
  },
  {
    id: "roadmap",
    title: "Roadmap",
    folderId: "product",
    excerpt: "What we are improving now, next, and later.",
    updated: "Yesterday",
    content: "Priorities flow from the [[North Star]], [[Customer Signals]], and [[Product Principles]]. The next milestone is [[Offline First]].",
  },
  {
    id: "product-principles",
    title: "Product Principles",
    folderId: "product",
    excerpt: "Quiet interfaces, durable data, and useful momentum.",
    updated: "Mon",
    content: "Honor [[Deep Work]], design for [[Offline First]], and make progress visible in the [[Daily Review]].",
  },
  {
    id: "offline-first",
    title: "Offline First",
    folderId: "product",
    excerpt: "The workspace should remain trustworthy without a connection.",
    updated: "Mon",
    content: "Supports the [[Product Principles]], the [[Roadmap]], and a dependable [[Writing Workflow]].",
  },
  {
    id: "customer-signals",
    title: "Customer Signals",
    folderId: "research",
    excerpt: "Patterns from interviews, feedback, and daily use.",
    updated: "Sun",
    content: "Feeds the [[North Star]], [[Roadmap]], and [[Campaign Systems]]. Explore [[Research Questions]] next.",
  },
  {
    id: "research-questions",
    title: "Research Questions",
    folderId: "research",
    excerpt: "What makes a personal workspace feel calm instead of demanding?",
    updated: "Sun",
    content: "Validate with [[Customer Signals]] and turn useful answers into [[Product Principles]].",
  },
  {
    id: "deep-work",
    title: "Deep Work",
    folderId: "journal",
    excerpt: "A protected block with one clear outcome.",
    updated: "Today",
    content: "Begin with the [[Focus Ritual]], capture stray ideas in [[Quick Notes]], and finish with a [[Daily Review]].",
  },
  {
    id: "focus-ritual",
    title: "Focus Ritual",
    folderId: "journal",
    excerpt: "Choose the work, clear the surface, start the timer.",
    updated: "Today",
    content: "Prepares [[Deep Work]], reinforces the [[North Star]], and reduces friction in the [[Writing Workflow]].",
  },
  {
    id: "daily-review",
    title: "Daily Review",
    folderId: "journal",
    excerpt: "Wins, open loops, and tomorrow's first meaningful action.",
    updated: "Today",
    content: "Close [[Deep Work]], update the [[Roadmap]], and move fragments from [[Quick Notes]] into permanent notes.",
  },
  {
    id: "quick-notes",
    title: "Quick Notes",
    folderId: "journal",
    excerpt: "A low-friction inbox for thoughts that should not interrupt focus.",
    updated: "Today",
    content: "Process during the [[Daily Review]] and connect useful fragments to [[Research Questions]] or the [[Writing Workflow]].",
  },
  {
    id: "writing-workflow",
    title: "Writing Workflow",
    folderId: "product",
    excerpt: "Collect, connect, draft, revise, and publish.",
    updated: "Fri",
    content: "Starts in [[Quick Notes]], develops through [[Deep Work]], and ships through [[Campaign Systems]] as [[Release Notes]].",
  },
  {
    id: "release-notes",
    title: "Release Notes",
    folderId: "product",
    excerpt: "A clear account of what changed and why it matters.",
    updated: "Fri",
    content: "Draw from the [[Roadmap]], follow the [[Writing Workflow]], and support the [[Launch Playbook]]. [[Release Archive]]",
  },
];

export const selectedShowcaseNote = showcaseNotes[0];
