export const codingLanguages = [
  { id: "pseudocode", label: "Pseudocode", versions: ["Structured", "Plain text"] },
  { id: "python", label: "Python", versions: ["3.10", "3.11", "3.12"] },
  { id: "javascript", label: "JavaScript", versions: ["ES2022", "Node.js 20"] },
  { id: "cpp", label: "C++", versions: ["C++17", "C++20"] },
  { id: "c", label: "C", versions: ["C11", "C17"] },
  { id: "java", label: "Java", versions: ["17", "21"] },
  { id: "sql", label: "SQL", versions: ["MySQL 8", "PostgreSQL 16", "SQLite 3"] },
];

export const defaultLanguageForTopic = (topic) => (topic === "dbms" ? "sql" : "pseudocode");
