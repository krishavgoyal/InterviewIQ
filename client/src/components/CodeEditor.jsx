import { useRef } from "react";
import { FaCode, FaEraser } from "react-icons/fa";
import { codingLanguages } from "../utils/codingLanguages";

function CodeEditor({ code, onCodeChange, language, onLanguageChange, version, onVersionChange }) {
  const textareaRef = useRef(null);
  const selectedLanguage = codingLanguages.find((item) => item.id === language) || codingLanguages[0];
  const lineCount = Math.max(1, code.split("\n").length);

  const handleLanguageChange = (nextLanguage) => {
    const next = codingLanguages.find((item) => item.id === nextLanguage) || codingLanguages[0];
    onLanguageChange(next.id);
    onVersionChange(next.versions[0]);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextCode = `${code.slice(0, start)}  ${code.slice(end)}`;
    onCodeChange(nextCode);
    window.setTimeout(() => textareaRef.current?.setSelectionRange(start + 2, start + 2), 0);
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><FaCode className="text-emerald-400" /> Coding workspace</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={language} onChange={(event) => handleLanguageChange(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 outline-none focus:border-emerald-400">
            {codingLanguages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={version} onChange={(event) => onVersionChange(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 outline-none focus:border-emerald-400">
            {selectedLanguage.versions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={() => onCodeChange("")} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white" title="Clear code"><FaEraser /> Clear</button>
        </div>
      </div>
      <div className="grid min-h-70 grid-cols-[auto_1fr] bg-slate-950">
        <pre aria-hidden="true" className="select-none border-r border-slate-800 bg-slate-900/70 px-3 py-4 text-right font-mono text-sm leading-6 text-slate-500">{Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}</pre>
        <textarea ref={textareaRef} value={code} onChange={(event) => onCodeChange(event.target.value)} onKeyDown={handleKeyDown} spellCheck="false" placeholder="Write your solution here. Use Tab for indentation." className="min-h-70 w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600" aria-label="Code editor" />
      </div>
      <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400">Your code is evaluated with your explanation. It is not executed, so explain assumptions and complexity when relevant.</p>
    </section>
  );
}

export default CodeEditor;
